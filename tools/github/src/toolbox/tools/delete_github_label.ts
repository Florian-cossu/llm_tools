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

export const TOOL_NAME = "delete_github_label";

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
        `Delete one label from a GitHub repository — cannot be undone. ` +
`Recreating a label with the same name does not restore it to former issues. ` +
`Confirm the exact name with the user before calling; prefer update_github_label for renames. ` +
`Call list_github_labels first to confirm the label exists. ` +
`Removes the label from every issue that carried it — report affected count only if ` +
`list_github_issues with "labels" of "<name>" was called beforehand. ` +
`Returns {deleted: true, name}. ` +
`Fails when the label doesn't exist or the token has no write access; not retryable.`,
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

        name: z
          .string()
          .min(1)
          .describe(
            `Exact name of the label to delete, as returned by list_github_labels. ` +
`Never invented or guessed — a near match fails or deletes the wrong label. ` +
`GitHub compares case-insensitively — "Bug" deletes an existing "bug".`,
          ),
      }),
    },
    async ({ owner, repository, name }) => withTracking("github", TOOL_NAME, async () => {
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
        .deleteLabel({
          owner: effectiveOwner,
          repo: effectiveRepository,
          name: name,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `${TOOL_NAME} failed to delete the label "${name}": ${reason}`,
          );
        });

      // The other label writes return the label read back from GitHub
      // (T4g). This one cannot: the endpoint answers 204 with no body,
      // and the label is gone. Echoing the name is the whole of what is
      // true afterwards, so it goes in "name" rather than in the
      // "label" key the create and update envelopes use for an object.
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ deleted: true, name: name }),
          },
        ],
      };
    }),
  );
};

export const deleteGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
