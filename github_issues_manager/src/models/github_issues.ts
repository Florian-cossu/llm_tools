import { GithubCompactMilestone } from "./github_milestones.js";

/**
 * Compact representation of a GitHub issue.
 */
export type GithubCompactIssue = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  labels: string[];
  assignees: string[];
  milestone: GithubCompactMilestone | null;
};