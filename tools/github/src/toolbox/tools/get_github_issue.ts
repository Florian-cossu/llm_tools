import z from "zod";
import { ToolInstance } from "../index.js";
import { mapGithubLabelNames, mapGithubMilestone } from "../../mappers/github_compact_mappers.js";
import { describeConfiguredRepository, describeDefault, isStringUsable, optionalWhenConfigured } from "@llm-tools/shared";

export const TOOL_NAME = "get_github_issue";

export const getGithubIssue: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Read a single issue of a GitHub repository by its number, ` +
        `including the body that list_github_issues leaves out. Use ` +
        `list_github_issues first when the number is not already known. ` +
        `Comments are not returned, only the issue itself. Returns ` +
        `{"number": number, "title", "state", "body", "labels", ` +
        `"assignees", "milestone"}, where "body" is the issue's ` +
        `description in Markdown and is null when it has none, and ` +
        `"milestone" is null or an object shaped as in ` +
        `list_github_issues.`,
      inputSchema: z.object({
        owner: optionalWhenConfigured(config.defaultOwner).describe(
          "GitHub repository owner (user or organisation). " +
            describeDefault(
              config.defaultOwner,
              `Required, as no default owner is configured on this ` +
                `server.`,
            ),
        ),

        repository: optionalWhenConfigured(config.defaultRepository).describe(
          "GitHub repository name without its owner. " +
            describeDefault(
              config.defaultRepository,
              `Required, as no default repository is configured on this ` +
                `server.`,
            ),
        ),

        number: z
          .number()
          .int()
          .positive()
          .describe(
            `The number identifying the issue within its repository, as ` +
              `shown in the GitHub interface and returned in the ` +
              `"number" field of list_github_issues results.`,
          ),
      }),
    },
    async ({ owner, repository, number }) => {
      const effectiveOwner = owner?.trim() || config.defaultOwner;
      const effectiveRepository = repository?.trim() || config.defaultRepository;

      if (
        !isStringUsable(effectiveOwner) ||
        !isStringUsable(effectiveRepository)
      ) {
        throw new Error(
          "No GitHub owner or repository was provided, and no default was configured.",
        );
      }

      const response = await config.octokit.rest.issues
        .get({
          owner: effectiveOwner,
          repo: effectiveRepository,
          issue_number: number,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Unable to retrieve issue "${number}": ${reason}`,
          );
        });

      const githubIssue = response.data

      const compactIssue = {
        number: githubIssue.number,
        state: githubIssue.state,
        title: githubIssue.title,
        milestone: githubIssue.milestone
          ? mapGithubMilestone(githubIssue.milestone)
          : null,
        labels: mapGithubLabelNames(githubIssue.labels),
        assignees: (githubIssue.assignees ?? []).map(
          (assignee) => assignee.login,
        ),
        body: githubIssue.body ? githubIssue.body : null,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(compactIssue),
          },
        ],
      };
    },
  );
};
