import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import { loadConfig } from "./config.js";
import { APP_NAME, APP_VERSION } from "./metadata.js";
import { TOOL_REGISTRARS } from "./tools/index.js";

/**
 * Entry point: reads the configuration, registers every tool, then serves
 * MCP over stdio.
 *
 * Nothing here may write to stdout, which carries the JSON-RPC stream.
 * Use stderr for diagnostics.
 *
 * You can test the tools locally by running the following:
 *
 * ```bash
 *  npx @modelcontextprotocol/inspector npx tsx src/index.ts
 * ```
 *
 * Once you have satisfying results you can then build the js
 * to use in your tool (LM Studio for example) by pointing the MCP
 * server to the dist folder
 *
 * ```bash
 *  npm run build
 * ```
 *
 */
const config = loadConfig();

const server = new McpServer({
  name: APP_NAME,
  version: APP_VERSION,
});

for (const registerTool of TOOL_REGISTRARS) {
  registerTool(server, config);
}

const transport = new StdioServerTransport();
await server.connect(transport);
