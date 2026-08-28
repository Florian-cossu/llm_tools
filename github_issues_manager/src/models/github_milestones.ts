/**
 * The shape of a github milestone as returned by the official github API
 */
export type GithubApiMilestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  description: string | null;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  closed_at: string | null;
  html_url: string;
};

/**
 * Compact representation of a GitHub milestone.
 */
export type GithubCompactMilestone = {
  number: number;
  title: string;
  state: "open" | "closed";
  description: string | null;
  dueOn: string | null;
};