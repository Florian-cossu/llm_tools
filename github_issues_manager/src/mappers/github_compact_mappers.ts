import type { GithubCompactIssue } from "../models/github_issues.js";
import type { GithubCompactMilestone } from "../models/github_milestones.js";

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

export type GithubApiIssue = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  labels: Array<{
    name: string;
  }>;
  assignees: Array<{
    login: string;
  }>;
  milestone: GithubApiMilestone | null;
  pull_request?: unknown;
};

export function mapGithubMilestone(
  milestone: GithubApiMilestone,
): GithubCompactMilestone {
  return {
    number: milestone.number,
    title: milestone.title,
    state: milestone.state,
    description: milestone.description,
    openIssues: milestone.open_issues,
    closedIssues: milestone.closed_issues,
    dueOn: milestone.due_on,
    closedAt: milestone.closed_at,
    url: milestone.html_url,
  };
}

export function mapGithubIssue(
  issue: GithubApiIssue,
): GithubCompactIssue {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    labels: issue.labels.map((label) => label.name),
    assignees: issue.assignees.map((assignee) => assignee.login),
    milestone: issue.milestone
      ? mapGithubMilestone(issue.milestone)
      : null,
  };
}