import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  describeMutation,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";

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
        `Change the title, state, description or due_on date ` +
        `of one milestone that already exists in the repository. The ` +
        `milestone is identified by "milestone_number"; every other parameter is a new ` +
        `value, and one left out is left unchanged - so pass only the ` +
        `fields the user asked to change rather than resending the ` +
        `whole milestone. At least one of "title", "state", "description" or ` +
        `"due_on" is required: a call carrying none of them is rejected ` +
        `rather than treated as a no-op. Call list_github_milestones with ` +
        `a limit of 60 first, both to confirm the milestone exists under ` +
        `the exact number being passed on and to follow the wording ` +
        `conventions the repository already uses. Returns {"updated": ` +
        `true, "milestone": {"number", "title", "state", "description", ` +
        `"dueOn"}}, the same milestone shape list_github_milestones and ` +
        `get_github_milestone return, read back from Github after the change. ` +
        `Renaming a milestone keeps it on the issues that ` +
        `carry it: those issues now show the new name, and no issue ` +
        `gains or loses the milestone. Nothing else about the issues ` +
        `changes, and no tool on this server can apply a milestone to an ` +
        `issue - say so rather than implying the issues were edited. ` +
        `The call fails when the repository has no milestone numbered "milestone_number" or ` +
        `when the configured token has no write access to the ` +
        `repository; none of those is retryable without changing the ` +
        `input.`,

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
          `The number of the milestone to update returned in the number field ` +
          `list_github_milestones results. Required and never invented: take ` +
          `it from list_github_milestones rather than from the user's wording, ` +
          `as the call fails when no milestones carries this number.`
        ),

        title: z
          .string()
          .optional()
          .describe(
            `The title to give the milestone instead, exactly as it should ` +
              `appear in the GitHub interface. Omit it to leave the title ` +
              `as it is - most edits change only the state or the ` +
              `description. A milestone title may contain spaces; pass it as ` +
              `it is, without quotes. Match the prefix, case and ` +
              `separator of the names list_github_milestones returns.`,
          ),

        state: z
        .enum(["open", "closed"])
        .optional()
        .describe(
          `The status to give a milestone instead. A closed milestone can ` +
            `be shut by hand, whether or not every issue in it was finished, so ` +
            `"closed" does not mean "delivered".`
        ),

        description: z
          .string()
          .optional()
          .describe(
            `The description to give the milestone instead: a short description ` +
              `saying what the milestone is for, shown beside it in GitHub. Omit ` +
              `it to leave the description as it is; pass an empty ` +
              `string to clear it. Call list_github_milestones with a ` +
              `"limit" of 60 to match the phrasing of the descriptions ` +
              `the repository already uses.`,
          ),

        due_on: z
        .string()
        .optional()
        .describe(
          `The due date to give the milestone instead. Omit it to leave the ` +
          `due date as it is. The due date must be a string in ISO 8601 with ` +
          `time + timezone as required by Github. For example: "2026-12-31T00:00:00Z"`
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
    }) => {
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
          `${TOOL_NAME} was called with nothing to change: pass at least one of "title", "state" "description" or "due_on".`,
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
          const reason = error instanceof Error ? error.message : String(error);
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
    },
  );
};

export const updateGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
