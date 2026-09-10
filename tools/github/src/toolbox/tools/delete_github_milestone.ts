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
        `Delete one milestone from a GitHub repository by number — cannot be undone. ` +
        `Recreating a milestone with the same title does not restore it to former issues. ` +
        `Confirm the exact milestone with the user before calling; prefer update_github_milestone for renames. ` +
        `Call list_github_milestones first to confirm it exists and check the title. ` +
        `Removes the milestone from every issue that carried it — report affected count only if ` +
        `list_github_issues with "search" of milestone:"<title>" was called beforehand. ` +
        `Returns {deleted: true, number}. ` +
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

        number: z
          .number()
          .int()
          .positive()
          .describe(
            `Number of the milestone to delete, from list_github_milestones. ` +
              `Never invented — a wrong number deletes the wrong milestone.`,
          ),
      }),
    },
    async ({ owner, repository, number }) =>
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

        await config.octokit.rest.issues
          .deleteMilestone({
            owner: effectiveOwner,
            repo: effectiveRepository,
            milestone_number: number,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
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
      }),
  );
};

export const deleteGithubMilestone: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
