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
        `Create one new milestone in a GitHub repository. A second call with ` +
        `the same name fails rather than doing nothing, so a failure here ` +
        `is not a reason to retry. Call list_github_milestones with a ` +
        `"limit" of 60 first, both to check that no existing milestone ` +
        `already covers the need and to follow the naming and wording ` +
        `conventions the repository already uses. Returns ` +
        `{"created": true, "milestone": {"number", "title", "state", ` +
        `"description", "dueOn"}}, the same milestone shape ` +
        `list_github_milestones returns, read back from GitHub - ` +
        `"description" is null when none was given, "state" is set to ` +
        `"open" if none is provided, and "dueOn" is null when no due date ` +
        `was given. Issue counts are not returned - call ` +
        `get_github_milestone with the "number" from this response for ` +
        `those. The new milestone carries no issues: nothing is ` +
        `linked by creating it - say so rather than implying the issues ` +
        `were updated. Assigning it to an issue is create_github_issue's ` +
        `job at creation time, or update_github_issue's afterwards - not ` +
        `this tool's. The call fails when ` +
        `the repository already has a milestone ` +
        `with this name, and when the configured token has no write ` +
        `access to the repository; neither is retryable without changing ` +
        `the input.`,
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
            `The title identifying the new milestone within its repository, exactly ` +
              `as it should appear in the GitHub interface. A milestone name may ` +
              `contain spaces; pass it as it is, without quotes. Required, and never ` +
              `invented: use the title the user asked for, matched to the prefix, ` +
              `case and separator of the titles list_github_milestones returns. GitHub ` +
              `compares titles case-insensitively, so "Milestone 1" collides with an ` +
              `existing "milestone 1" and the call fails.`,
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
              `title. Call list_github_milestones with a "limit" of 60 to ` +
              `match the phrasing of the descriptions the repository ` +
              `already uses.`,
          ),

        due_on: z
          .string()
          .optional()
          .describe(
            `The due date to give the milestone instead. Omit it to leave the ` +
              `due date as it is. The due date must be a string in ISO 8601 with ` +
              `time + timezone as required by Github. For example: "2026-12-31T00:00:00Z"`,
          ),
      }),
    },
    async ({ owner, repository, title, state, description, due_on }) => withTracking("github", TOOL_NAME, async () => {
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
          const reason = error instanceof Error ? error.message : String(error);
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
