import { McpServer } from "@modelcontextprotocol/server";
import { ServerConfig } from "../index.js";
import { listGithubIssuesByRepoTool } from "./tools/list_github_issues_by_repo.js";
import { getGithubIssue } from "./tools/get_github_issue.js";
import { getGithubMilestone } from "./tools/get_github_milestone.js";
import { listGithubMilestonesByRepo } from "./tools/list_github_milestones_by_repo.js";

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
  getGithubMilestone,
  listGithubIssuesByRepoTool,
  listGithubMilestonesByRepo,
];