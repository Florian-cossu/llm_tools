import { GithubApiIssue, GithubCompactIssue } from "../models/github_issues.js";
import { GithubApiMilestone, GithubCompactMilestone } from "../models/github_milestones.js";
import { isStringUsable } from "../utils/string_utils.js";

export function mapGithubMilestone(
  milestone: GithubApiMilestone,
): GithubCompactMilestone {
  return {
    number: milestone.number,
    title: milestone.title,
    state: milestone.state,
    description: milestone.description,
    dueOn: milestone.due_on,
  };
}

export function mapGithubIssue(
  issue: GithubApiIssue,
): GithubCompactIssue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: mapGithubLabelNames(issue.labels),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    milestone: issue.milestone
    ? mapGithubMilestone(issue.milestone)
    : null,
  };
}

export function mapGithubLabelNames(
  labels: Array<string | { name?: string }>,
): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter(isStringUsable);
}