import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "get_github_milestone";

export const TOOL_EFFECT: ToolEffect = "read";

const register: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Read one milestone by its number. Use list_github_milestones ` +
        `first when the number is unknown. Returns {"number", "title", ` +
        `"state", "description", "dueOn", "openIssues", "closedIssues"}.`,
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
    async ({ owner, repository, number }) => withTracking("github", TOOL_NAME, async () => {
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
    }),
  );
};

export const getGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
