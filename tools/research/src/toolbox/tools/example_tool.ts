import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { ToolEffect } from "@llm-tools/shared";
import type { ServerConfig } from "../../index.ts";
import type { ToolRegistration } from "../index.ts";

export const TOOL_NAME = "example_tool";

/**
 * What calling this does upstream: "read", "write" or "destructive".
 * Keep it honest - the server gates registration on it, and a "read"
 * tool that mutates is a defect. See ADR-0007.
 */
export const TOOL_EFFECT: ToolEffect = "read";

function register(
  server: McpServer,
  config: ServerConfig,
): void {
  server.registerTool(
    TOOL_NAME,
    {
      description: "An example tool. Replace this with your own implementation.",
      inputSchema: z.object({
        message: z.string().describe("A message to echo back"),
      }),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ echo: message }),
          },
        ],
      };
    },
  );
}

export const exampleTool: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
