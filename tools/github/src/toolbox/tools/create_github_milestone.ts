import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  describeMutation,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";
import { DEFAULT_MILESTONE_LIMIT } from "../../metadata.js";

export const TOOL_NAME = "create_github_milestone";

export const TOOL_EFFECT: ToolEffect = "write";

const register: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        describeMutation(TOOL_EFFECT) +
        `Create one milestone. Duplicate title fails — not a reason to retry. ` +
        `Call list_github_milestones first to check for duplicates and match naming conventions. ` +
        `Creating a milestone links no issues — assign via create_github_issue or update_github_issue. ` +
        `Returns {created: true, milestone: {number, title, state, description, dueOn}}. ` +
        `Fails when the title already exists or the token has no write access; not retryable.`,
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

        title: z
          .string()
          .min(1)
          .describe(
            `Milestone title, exactly as it should appear in GitHub. ` +
              `May contain spaces — pass as-is. Never invented: use what the user asked for. ` +
              `GitHub compares case-insensitively — "v1.0" collides with "V1.0".`,
          ),

        state: z
          .enum(["open", "closed"])
          .optional()
          .describe(
            `The status to give the milestone instead. A closed milestone can ` +
              `be shut by hand, whether or not every issue in it was finished, so ` +
              `"closed" does not mean "delivered".`,
          ),

        description: z
          .string()
          .optional()
          .describe(
            `A short sentence saying what the milestone is for, shown ` +
              `beside it in GitHub. Omit it rather than restating the ` +
              `title. Call list_github_milestones with a "limit" of ${DEFAULT_MILESTONE_LIMIT} to ` +
              `match the phrasing of the descriptions the repository ` +
              `already uses.`,
          ),

        due_on: z
          .string()
          .optional()
          .describe(
            `Due date as ISO 8601 with time and timezone. Example: "2026-12-31T00:00:00Z". ` +
              `Omit to create without a due date.`,
          ),
      }),
    },
    async ({ owner, repository, title, state, description, due_on }) =>
      withTracking("github", TOOL_NAME, async () => {
        const effectiveOwner = owner?.trim() || config.defaultOwner;
        const effectiveRepository =
          repository?.trim() || config.defaultRepository;

        if (
          !isStringUsable(effectiveOwner) ||
          !isStringUsable(effectiveRepository)
        ) {
          throw new Error(
            "No GitHub owner or repository was provided, and no default was configured.",
          );
        }

        const response = await config.octokit.rest.issues
          .createMilestone({
            owner: effectiveOwner,
            repo: effectiveRepository,
            title: title,
            state: state,
            description: description,
            due_on: due_on,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed to create the milestone "${title}": ${reason}`,
            );
          });

        const payload = mapGithubMilestone(response.data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ created: true, milestone: payload }),
            },
          ],
        };
      }),
  );
};

export const createGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
