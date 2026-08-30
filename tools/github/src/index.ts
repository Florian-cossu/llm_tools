import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  APP_NAME,
  APP_VERSION
} from "./metadata.js";
import { Octokit } from "octokit";
import { stringOrNull } from "@llm-tools/shared";
import { TOOL_INSTANCES } from "./toolbox/index.js";
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
}

const server = new McpServer(
  {
    name: APP_NAME,
    version: APP_VERSION,
  },
  {
    instructions: buildServerInstructions(config),
  },
);

for (const registerTool of TOOL_INSTANCES) {
  registerTool(server, config)
}

const transport = new StdioServerTransport();
await server.connect(transport);
