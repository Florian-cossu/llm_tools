import { GithubApiMilestone, GithubCompactMilestone } from "./github_milestones.js";

/**
 * The shape of a github issue as returned by the official github API
 */
export type GithubApiIssue = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  labels: Array<{
    name: string;
  }>;
  /** The search endpoint omits this field entirely on unassigned issues. */
  assignees?: Array<{
    login: string;
  }> | null;
  milestone: GithubApiMilestone | null;
  pull_request?: unknown;
};

/**
 * Compact representation of a GitHub issue.
 */
export type GithubCompactIssue = {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  assignees: string[];
  milestone: GithubCompactMilestone | null;
};