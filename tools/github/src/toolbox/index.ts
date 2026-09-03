import { McpServer } from "@modelcontextprotocol/server";
import { ToolEffect } from "@llm-tools/shared";
import { ServerConfig } from "../index.js";
import { listGithubIssuesTool } from "./tools/list_github_issues.js";
import { getGithubIssue } from "./tools/get_github_issue.js";
import { getGithubMilestone } from "./tools/get_github_milestone.js";
import { listGithubMilestones } from "./tools/list_github_milestones.js";
import { listGithubLabels } from "./tools/list_github_labels.js";
import { getGithubLabel } from "./tools/get_github_label.js";
import { createGithubLabel } from "./tools/create_github_label.js";
import { updateGithubLabel } from "./tools/update_github_label.js";
import { deleteGithubLabel } from "./tools/delete_github_label.js";

/**
 * Registers one tool on the server.
 *
 * Every tool module keeps a function of this shape, so that adding a
 * tool means writing its file and listing it below.
 */
export type ToolInstance = (
  server: McpServer,
  config: ServerConfig,
) => void;

/**
 * One tool, as the server sees it before deciding to register it.
 *
 * The name and the effect sit outside the registrar on purpose: the gate
 * in `index.ts` has to know what a tool does *before* it is registered,
 * and the permission layer will need to enumerate tools without running
 * their registration. See
 * [ADR-0007](../../../../docs/03-decisions/ADR-0007-writes-behind-declared-capability.md).
 */
export type ToolRegistration = {
  /** The public tool name, as the model sees it - matches `TOOL_NAME`. */
  name: string;
  /** What calling it does upstream. `read` unless it mutates. */
  effect: ToolEffect;
  /** Registers the tool. Called only once the gate has allowed it. */
  register: ToolInstance;
};

/**
 * Every tool the server can expose.
 *
 * To add a tool: create `tools/<tool_name>.ts` exporting a
 * `ToolRegistration`, then add it to this list. Nothing else needs to
 * change.
 *
 * **Being listed here is necessary, not sufficient.** A tool whose
 * effect the configuration does not allow is skipped at startup and
 * never reaches the model - `index.ts` holds that gate.
 */
export const TOOL_REGISTRATIONS: ToolRegistration[] = [
  createGithubLabel,
  getGithubIssue,
  getGithubLabel,
  getGithubMilestone,
  listGithubIssuesTool,
  listGithubLabels,
  listGithubMilestones,
  updateGithubLabel,
  deleteGithubLabel,
];
