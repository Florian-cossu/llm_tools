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

export const TOOL_NAME = "delete_github_label";

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
        `Delete one label from a GitHub repository, by its name. This ` +
        `cannot be undone: no endpoint restores a deleted label, and ` +
        `recreating one with the same name does not put it back on the ` +
        `issues it was removed from, because GitHub keeps no record of ` +
        `which issues those were. Ask the user to confirm this exact ` +
        `label by name before calling, and prefer update_github_label ` +
        `when the user wants the label renamed, recoloured or ` +
        `redescribed rather than gone. Call list_github_labels or ` +
        `get_github_label first to confirm the label exists under the ` +
        `exact name being passed, and to check the name is the one the ` +
        `user meant. Returns {"deleted": true, "name"}, echoing the ` +
        `name that was deleted - GitHub answers with an empty body, so ` +
        `unlike create_github_label and update_github_label there is no ` +
        `label object to read back, and the label it described no ` +
        `longer exists. Deleting a label removes it from every issue ` +
        `that carried it; those issues are not otherwise changed and ` +
        `none of them is closed or deleted. Report how many issues were ` +
        `affected only if list_github_issues with a "labels" of ` +
        `"<name>" was called beforehand - this tool does not say, and ` +
        `afterwards nothing can. The call fails when the repository has ` +
        `no label with this name, and when the configured token has no ` +
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

        name: z
          .string()
          .min(1)
          .describe(
            `The name of the label to delete, exactly as shown in the ` +
              `GitHub interface and returned in the "name" field of ` +
              `list_github_labels results. A label name may contain ` +
              `spaces; pass it as it is, without quotes. Required, and ` +
              `never invented or guessed at: take it from ` +
              `list_github_labels rather than from the user's wording, ` +
              `since a name that nearly matches either fails or deletes ` +
              `the wrong label. GitHub compares names ` +
              `case-insensitively, so "Bug" deletes an existing "bug".`,
          ),
      }),
    },
    async ({ owner, repository, name }) => {
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
    },
  );
};

export const deleteGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
