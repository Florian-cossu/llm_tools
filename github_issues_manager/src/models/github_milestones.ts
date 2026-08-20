/**
 * Compact representation of a GitHub milestone.
 */
export type GithubCompactMilestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  description: string | null;
  openIssues: number;
  closedIssues: number;
  dueOn: string | null;
  closedAt: string | null;
  url: string;
};