import { McpServer } from "@modelcontextprotocol/server";
import { ServerConfig } from "../index.js";
import { listGithubIssuesTool } from "./tools/list_github_issues.js";
import { getGithubIssue } from "./tools/get_github_issue.js";
import { getGithubMilestone } from "./tools/get_github_milestone.js";
import { listGithubMilestones } from "./tools/list_github_milestones.js";
import { listGithubLabels } from "./tools/list_github_labels.js";
import { getGithubLabel } from "./tools/get_github_label.js";

/**
 * Registers one tool on the server.
 *
 * Every tool module exports a function of this shape, so that adding a
 * tool means writing its file and listing it below.
 */
export type ToolInstance = (
  server: McpServer,
  config: ServerConfig,
) => void;

/**
 * Every tool the server exposes.
 *
 * To add a tool: create `tools/<tool_name>.ts` exporting a
 * `ToolInstance`, then add it to this list. Nothing else needs to change.
 */
export const TOOL_INSTANCES: ToolInstance[] = [
  getGithubIssue,
  getGithubLabel,
  getGithubMilestone,
  listGithubIssuesTool,
  listGithubLabels,
  listGithubMilestones,
];
