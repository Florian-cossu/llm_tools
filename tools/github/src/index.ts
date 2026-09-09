import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  APP_NAME,
  APP_VERSION
} from "./metadata.js";
import { Octokit } from "octokit";
import { stringOrNull } from "@llm-tools/shared";
import { TOOL_REGISTRATIONS } from "./toolbox/index.js";
import { buildServerInstructions } from "./server_instructions.js";
import { fileURLToPath } from "node:url";
import { getActiveTokenName, isToolAllowed } from "@llm-tools/data"
import { getActiveGithubProfile } from "./utils/get_repo_config.js";

export type ServerConfig = {
  /** Server Name */
  serverName: string;
  /** Server version */
  serverVersion: string;
  /** Personal access token */
  token: string | null;
  /** Octokit instance */
  octokit: Octokit;
  /** Login substituted for the "@me" assignee sentinel. */
  defaultUsername: string | null;
  /** Repository owner used when a tool call omits it. */
  defaultOwner: string | null;
  /** Repository name used when a tool call omits it. */
  defaultRepository: string | null;
};

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  // stdout is the JSON-RPC channel on a stdio server, so dotenv's
  // startup banner has to stay off it.
  quiet: true,
});

// The permission table's `env` rows name the active token per server + type
// (ADR-0008's pattern extended to credentials) - this reads which env var is
// active for github's "auth" type, then the value out of process.env. Never
// a hardcoded `GITHUB_TOKEN` lookup: the active row can point at any key.
//
// `token`, `octokit`, `defaultOwner` and `defaultRepository` below are
// getters, not plain fields: every tool handler closes over the same
// `config` object, so re-reading the DB/env on each access means switching
// the active token or profile in the control panel takes effect on a tool's
// very next call - no restart needed. What a restart is still needed for is
// tool descriptions and input schemas (e.g. `describeConfiguredRepository`
// in each tool file), since those are strings baked in once at
// `registration.register(server, config)` below, not re-evaluated per call.
function resolveActiveToken(): string | null {
  const activeTokenName = getActiveTokenName("github", "auth");

  if (!activeTokenName) {
    console.error(
      "No active auth token configured for github - set one active in the control panel.",
    );
    return null;
  }

  const value = stringOrNull(process.env[activeTokenName]);

  if (!value) {
    console.error(
      `Active auth token "${activeTokenName}" has no value in tools/github/.env.`,
    );
  }

  return value;
}

const config: ServerConfig = {
  serverName: APP_NAME,
  serverVersion: APP_VERSION,
  get token() {
    return resolveActiveToken();
  },
  get octokit() {
    return new Octokit({ auth: this.token });
  },
  defaultUsername: stringOrNull(process.env.GITHUB_DEFAULT_USERNAME),
  get defaultOwner() {
    return stringOrNull(getActiveGithubProfile()?.repository_owner);
  },
  get defaultRepository() {
    return stringOrNull(getActiveGithubProfile()?.repository_name);
  },
}

// The gate is here rather than inside the handlers: a tool the
// permission table does not allow is never registered, so the model is
// not shown a capability and asked not to use it (ADR-0007 D4). The tool
// list is fixed at initialisation, so this decision holds for the life
// of the process - changing a row in the permission table needs a
// restart (ADR-0008).
const allowed = TOOL_REGISTRATIONS.filter((registration) => {
  const isAllowed = isToolAllowed(registration.name, "github");

  if (!isAllowed) {
    // stdout is the JSON-RPC channel, so this goes to stderr - where a
    // user wondering why a tool is missing will find the reason.
    console.error(
      `Not registering ${registration.name}: its permission table state is not "allow".`,
    );
  }

  return isAllowed;
});

const server = new McpServer(
  {
    name: APP_NAME,
    version: APP_VERSION,
  },
  {
    // Built from what the gate allowed, not from the full toolbox: the
    // instructions promise the model a read-only server only when that
    // is what it got.
    instructions: buildServerInstructions(config, allowed),
  },
);

for (const registration of allowed) {
  registration.register(server, config);
}

const transport = new StdioServerTransport();
await server.connect(transport);
