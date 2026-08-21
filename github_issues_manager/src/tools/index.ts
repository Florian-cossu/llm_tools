import { registerListGithubIssuesTool } from "./list_github_issues.js";
import type { ToolRegistrar } from "./tool_registrar.js";

/**
 * Every tool the server exposes.
 *
 * To add a tool: create `tools/<tool_name>.ts` exporting a
 * `ToolRegistrar`, then add it to this list. Nothing else needs to change.
 */
export const TOOL_REGISTRARS: ToolRegistrar[] = [
  registerListGithubIssuesTool,
];

export type { ToolRegistrar };
