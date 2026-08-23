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