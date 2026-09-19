import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { APP_NAME, APP_VERSION } from "./metadata.ts";
import { buildServerInstructions } from "./server_instructions.ts";
import { TOOL_REGISTRATIONS } from "./toolbox/index.ts";

export type ServerConfig = {
  serverName: string;
  serverVersion: string;
};

const config: ServerConfig = {
  serverName: APP_NAME,
  serverVersion: APP_VERSION,
};

const server = new McpServer(
  {
    name: APP_NAME,
    version: APP_VERSION,
  },
  {
    instructions: buildServerInstructions(),
  },
);

for (const registration of TOOL_REGISTRATIONS) {
  registration.register(server, config);
}

const transport = new StdioServerTransport();
await server.connect(transport);
