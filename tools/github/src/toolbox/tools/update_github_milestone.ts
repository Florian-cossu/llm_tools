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

export const TOOL_NAME = "update_github_milestone";

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
        `Change the title, state, description or due date of one existing milestone by number. ` +
        `Omitted fields are left unchanged — pass only what the user asked to change. ` +
        `At least one field required. Renaming keeps the milestone on all issues it carried. ` +
        `Assigning a milestone to an issue is update_github_issue's job, not this tool's. ` +
        `Returns {updated: true, milestone: {number, title, state, description, dueOn}}. ` +
        `Fails when the milestone number doesn't exist or the token has no write access; not retryable.`,

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

        milestone_number: z
          .number()
          .int()
          .positive()
          .describe(
            `Number of the milestone to update, from list_github_milestones. ` +
              `Never invented — the call fails if no milestone carries this number.`,
          ),

        title: z
          .string()
          .optional()
          .describe(
            `New title. Omit to leave unchanged. Match the style of list_github_milestones results.`,
          ),

        state: z
          .enum(["open", "closed"])
          .optional()
          .describe(
            `The status to give a milestone instead. A closed milestone can ` +
              `be shut by hand, whether or not every issue in it was finished, so ` +
              `"closed" does not mean "delivered".`,
          ),

        description: z
          .string()
          .optional()
          .describe(
            `New description. Omit to leave unchanged; pass "" to clear. Call list_github_milestones` +
              `with a "limit" of ${DEFAULT_MILESTONE_LIMIT} to match the phrasing of the descriptions ` +
              `the repository already uses.`,
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
    async ({
      owner,
      repository,
      milestone_number,
      title,
      state,
      description,
      due_on,
    }) =>
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

        if (
          title === undefined &&
          state === undefined &&
          description === undefined &&
          due_on === undefined
        ) {
          throw new Error(
            `${TOOL_NAME} was called with nothing to change: pass at least one of "title", "state", "description" or "due_on".`,
          );
        }

        const response = await config.octokit.rest.issues
          .updateMilestone({
            owner: effectiveOwner,
            repo: effectiveRepository,
            milestone_number: milestone_number,
            title: title,
            state: state,
            description: description,
            due_on: due_on,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed to update milestone "${milestone_number}": ${reason}`,
            );
          });

        const payload = mapGithubMilestone(response.data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ updated: true, milestone: payload }),
            },
          ],
        };
      }),
  );
};

export const updateGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
