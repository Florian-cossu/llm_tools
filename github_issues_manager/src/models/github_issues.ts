import { GithubCompactMilestone } from "./github_milestones.js";

/**
 * Compact representation of a GitHub issue.
 */
export type GithubCompactIssue = {
  number: number;
  title: string;
  state: string;
  labels: string[];
  assignees: string[];
  milestone: GithubCompactMilestone | null;
};