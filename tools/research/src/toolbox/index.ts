import type { McpServer } from "@modelcontextprotocol/server";
import type { ToolEffect } from "@llm-tools/shared";
import type { ServerConfig } from "../index.ts";
import { exampleTool } from "./tools/example_tool.ts";

export type ToolInstance = (server: McpServer, config: ServerConfig) => void;

/**
 * One tool, as the server sees it before deciding to register it. The
 * name and effect sit outside the registrar so the gate in index.ts can
 * read them without running anything (ADR-0007).
 */
export type ToolRegistration = {
  name: string;
  effect: ToolEffect;
  register: ToolInstance;
};

/** Every tool this server can expose - listed is not the same as registered. */
export const TOOL_REGISTRATIONS: ToolRegistration[] = [exampleTool];
