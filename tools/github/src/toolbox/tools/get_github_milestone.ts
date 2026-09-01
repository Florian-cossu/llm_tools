import z from "zod";
import { ToolInstance } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "get_github_milestone";

export const getGithubMilestone: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Read a single milestone of a GitHub repository by its number, ` +
        `including the issue counts that list_github_milestones ` +
        `leaves out. Milestones are numbered independently of issues, so ` +
        `milestone 1 has nothing to do with issue 1; call ` +
        `list_github_milestones first when the number is not ` +
        `already known. The issues belonging to the milestone are not ` +
        `returned - list them with list_github_issues and a "search" of ` +
        `milestone:"<title>". Returns {"number", "title", "state", ` +
        `"description", "dueOn", "openIssues", "closedIssues"}, where ` +
        `"description" and "dueOn" are null when unset, "dueOn" is an ISO ` +
        `8601 timestamp, and "openIssues" and "closedIssues" count the ` +
        `issues assigned to the milestone and so give its progress. The ` +
        `call fails when the repository has no milestone with this ` +
        `number.`,
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
            `The number identifying the milestone within its repository, ` +
              `as shown in the GitHub interface and returned in the ` +
              `"number" field of list_github_milestones results. ` +
              `This is the milestone's own number, not the number of an ` +
              `issue it contains.`,
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
        .getMilestone({
          owner: effectiveOwner,
          repo: effectiveRepository,
          milestone_number: number,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Unable to retrieve milestone "${number}": ${reason}`,
          );
        });

      const githubMilestone = response.data;

      // The compact shape shared with list_github_milestones, plus
      // the issue counts that justify reading a milestone one at a time.
      const detailedMilestone = {
        ...mapGithubMilestone(githubMilestone),
        openIssues: githubMilestone.open_issues,
        closedIssues: githubMilestone.closed_issues,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(detailedMilestone),
          },
        ],
      };
    },
  );
};
