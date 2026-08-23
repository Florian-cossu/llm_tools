import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_ISSUE_STATE,
  DEFAULT_ISSUE_LIMIT,
} from "./metadata.js";
import {
  GithubApiIssue,
  mapGithubIssue,
} from "./mappers/github_compact_mappers.js";
import { GithubCompactIssue } from "./models/github_issues.js";
import { Octokit } from "octokit";
import { isStringUsable, stringOrNull } from "./utils/string_utils.js";
import { TOOL_INSTANCES } from "./toolbox/index.js";

export type ServerConfig = {
  /** Server Name */
  serverName: string;
  /** Server version */
  serverVersion: string;
  /** Personal access token */
  token: string | null;
  /** Login substituted for the "@me" assignee sentinel. */
  defaultUsername: string | null;
  /** Repository owner used when a tool call omits it. */
  defaultOwner: string | null;
  /** Repository name used when a tool call omits it. */
  defaultRepository: string | null;
};

const server = new McpServer({
  name: APP_NAME,
  version: APP_VERSION,
});

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const config = {
  serverName: APP_NAME,
  serverVersion: APP_VERSION,
  token: stringOrNull(process.env.GITHUB_TOKEN),
  defaultUsername: stringOrNull(process.env.GITHUB_DEFAULT_USERNAME),
  defaultOwner: stringOrNull(process.env.GITHUB_DEFAULT_OWNER),
  defaultRepository: stringOrNull(process.env.GITHUB_DEFAULT_REPOSITORY),
}

for (const registerTool of TOOL_INSTANCES) {
  registerTool(server, config)
}

const transport = new StdioServerTransport();
await server.connect(transport);
