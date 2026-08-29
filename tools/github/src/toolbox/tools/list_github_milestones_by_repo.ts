import z from "zod";
import { ToolInstance } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
} from "@llm-tools/shared";

export const TOOL_NAME = "list_github_milestones_by_repo";

export const listGithubMilestonesByRepo: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Search the milestones of a Github repository and return one page of matches in a compact form:`,
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

        // TODO: replace with the parameters this tool actually takes.
        number: z
          .number()
          .int()
          .positive()
          .describe(
            `The number identifying the issue within its repository, as ` +
              `shown in the GitHub interface.`,
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

      // TODO: call the GitHub API and map the response into a compact shape.
      const response = await config.octokit.rest.issues
        .get({
          owner: effectiveOwner,
          repo: effectiveRepository,
          issue_number: number,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`${TOOL_NAME} failed for "${number}": ${reason}`);
        });

      const payload = response.data;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      };
    },
  );
};
