import type { McpServer } from "@modelcontextprotocol/server";

import type { ServerConfig } from "../config.js";

/**
 * Registers one tool on the server.
 *
 * Every tool module exports a function of this shape, so that adding a
 * tool means writing its file and listing it in `tools/index.ts`.
 */
export type ToolRegistrar = (
  server: McpServer,
  config: ServerConfig,
) => void;
