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
import { mapGithubLabel } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "update_github_label";

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
        `Change the name, colour or description of one existing label. ` +
        `Identified by current "name"; omitted fields are left unchanged. ` +
        `At least one of "newName", "color", "description" required. ` +
        `Renaming keeps the label on all issues it carried — no issue gains or loses it. ` +
        `Call list_github_labels first to confirm the exact name. ` +
        `Returns {updated: true, label: {name, description, color, default}}. ` +
        `Fails when the label doesn't exist, "newName" collides, or the token has no write access; not retryable.`,
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
            `Current name of the label to change, exactly as returned by list_github_labels. ` +
              `Never the new name — use "newName" to rename. ` +
              `Never invented: the call fails if no label carries this name.`,
          ),

        newName: z
          .string()
          .min(1)
          .optional()
          .describe(
            `New name for the label. Omit to leave unchanged. ` +
              `GitHub compares case-insensitively — "Bug" collides with existing "bug".`,
          ),

        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
          .describe(
            `New colour as a six-digit hex code, with or without "#". Omit to leave unchanged. ` +
              `Three-digit shorthand and colour names rejected. Ask the user when colour matters.`,
          ),

        description: z
          .string()
          .max(100)
          .optional()
          .describe(
            `New description, max 100 characters. Omit to leave unchanged; pass "" to clear. ` +
              `Call list_github_labels with a "limit" of 10 to match the phrasing of the ` +
              `descriptions the repository already uses.`,
          ),
      }),
    },
    async ({ owner, repository, name, newName, color, description }) =>
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

        // GitHub accepts an update carrying no new value and returns the
        // label untouched. Reporting that back as {"updated": true} would
        // tell the model a change landed when none did, so it is refused
        // here rather than sent.
        if (
          newName === undefined &&
          color === undefined &&
          description === undefined
        ) {
          throw new Error(
            `${TOOL_NAME} was called with nothing to change: pass at least one of "newName", "color" or "description".`,
          );
        }

        const response = await config.octokit.rest.issues
          .updateLabel({
            owner: effectiveOwner,
            repo: effectiveRepository,
            name: name,
            new_name: newName,
            color: color?.replace("#", ""),
            description: description,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed to update the label "${name}": ${reason}`,
            );
          });

        const payload = mapGithubLabel(response.data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ updated: true, label: payload }),
            },
          ],
        };
      }),
  );
};

export const updateGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
