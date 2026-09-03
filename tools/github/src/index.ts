import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  APP_NAME,
  APP_VERSION
} from "./metadata.js";
import { Octokit } from "octokit";
import { booleanFromEnv, registrationRefusal, stringOrNull } from "@llm-tools/shared";
import { TOOL_REGISTRATIONS } from "./toolbox/index.js";
import { buildServerInstructions } from "./server_instructions.js";
import { fileURLToPath } from "node:url";

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
  /**
   * Whether mutating tools may be registered at all.
   *
   * Off unless `GITHUB_ALLOW_WRITES` says otherwise, so a server that
   * nobody configured for writes exposes none - see
   * [ADR-0007](../../../docs/03-decisions/ADR-0007-writes-behind-declared-capability.md).
   */
  allowWrites: boolean;
};

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  // stdout is the JSON-RPC channel on a stdio server, so dotenv's
  // startup banner has to stay off it.
  quiet: true,
});

const token = stringOrNull(process.env.GITHUB_TOKEN);
const octokit = new Octokit({ auth: token });

const config: ServerConfig = {
  serverName: APP_NAME,
  serverVersion: APP_VERSION,
  token: token,
  octokit: octokit,
  defaultUsername: stringOrNull(process.env.GITHUB_DEFAULT_USERNAME),
  defaultOwner: stringOrNull(process.env.GITHUB_DEFAULT_OWNER),
  defaultRepository: stringOrNull(process.env.GITHUB_DEFAULT_REPOSITORY),
  allowWrites: booleanFromEnv(process.env.GITHUB_ALLOW_WRITES),
}

// The gate is here rather than inside the handlers: a tool the
// configuration does not allow is never registered, so the model is not
// shown a capability and asked not to use it (ADR-0007 D4). The tool
// list is fixed at initialisation, so this decision holds for the life
// of the process - changing GITHUB_ALLOW_WRITES needs a restart.
const allowed = TOOL_REGISTRATIONS.filter((registration) => {
  const refusal = registrationRefusal(registration.effect, config.allowWrites);

  if (refusal !== null) {
    // stdout is the JSON-RPC channel, so this goes to stderr - where a
    // user wondering why a tool is missing will find the reason.
    console.error(`Not registering ${registration.name}: it ${refusal}.`);
  }

  return refusal === null;
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
