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

export const TOOL_NAME = "delete_github_milestone";

export const TOOL_EFFECT: ToolEffect = "destructive";

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
        `Delete one milestone from a GitHub repository, by its milestone ` +
        `number. Cannot be undone: no endpoint restores a deleted milestone, and ` +
        `recreating one with the same title does not put it back on the ` +
        `issues it was removed from, because GitHub keeps no record of ` +
        `which issues those were. Ask the user to confirm this exact ` +
        `milestone by title before calling, and prefer update_github_milestone ` +
        `when the user wants the milestone renamed or redescribed rather than ` +
        `gone. Call list_github_milestones or get_github_milestone first to confirm ` +
        `the milestone exists under the exact number being passed, and to check the ` +
        `title is the one the user meant. Returns {"deleted": true, "number"}, ` +
        `echoing the number that was deleted - GitHub answers with an empty body, so ` +
        `unlike create_github_milestone and update_github_milestone there is no ` +
        `milestone object to read back, and the milestone it described no ` +
        `longer exists. Deleting a milestone removes it from every issue ` +
        `that carried it; those issues are not otherwise changed and ` +
        `none of them is closed or deleted. Report how many issues were ` +
        `affected only if list_github_issues with a "search" of ` +
        `milestone:"<title>" was called beforehand - this tool does not say, and ` +
        `afterwards nothing can. The call fails when the repository has ` +
        `no milestone numbered "number", and when the configured token has no ` +
        `write access to the repository; neither is retryable without ` +
        `changing the input.`,
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
            `The number identifying the milestone to delete, as shown in ` +
              `the GitHub interface and returned in the "number" field of ` +
              `list_github_milestones results. Required, and never ` +
              `invented or guessed at: take it from list_github_milestones ` +
              `rather than from the user's wording, since a wrong number ` +
              `deletes the wrong milestone.`,
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

      await config.octokit.rest.issues
        .deleteMilestone({
          owner: effectiveOwner,
          repo: effectiveRepository,
          milestone_number: number,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `${TOOL_NAME} failed to delete the milestone "${number}": ${reason}`,
          );
        });

      // The other milestone writes return the milestone read back from
      // GitHub (T4g). This one cannot: the endpoint answers 204 with no
      // body, and the milestone is gone. Echoing the number is the whole
      // of what is true afterwards, so it goes in "number" rather than
      // the "milestone" key the create and update envelopes use for an
      // object.
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ deleted: true, number: number }),
          },
        ],
      };
    },
  );
};

export const deleteGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
