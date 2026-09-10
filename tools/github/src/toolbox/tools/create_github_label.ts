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

export const TOOL_NAME = "create_github_label";

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
        `Create one label. Duplicate name fails — not a reason to retry. ` +
        `Call list_github_labels first to check for duplicates and match naming conventions. ` +
        `Creating a label applies it to no issues — use update_github_issue's "labels" param to apply it. ` +
        `Returns {created: true, label: {name, description, color, default}}. ` +
        `Fails when the name already exists or the token has no write access; not retryable.`,
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
            `Label name, exactly as it should appear in GitHub. ` +
              `May contain spaces — pass as-is. Never invented: use what the user asked for. ` +
              `GitHub compares case-insensitively — "Bug" collides with "bug".`,
          ),

        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
          .describe(
            `Six-digit hex code, with or without leading "#". ` +
              `Three-digit shorthand and colour names are rejected. ` +
              `Omit to let GitHub pick; ask the user when colour matters.`,
          ),

        description: z
          .string()
          .max(100)
          .optional()
          .describe(
            `Short sentence describing the label, max 100 characters. ` +
              `Omit rather than restating the name.`,
          ),
      }),
    },
    async ({ owner, repository, name, color, description }) =>
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
          .createLabel({
            owner: effectiveOwner,
            repo: effectiveRepository,
            name: name,
            color: color?.replace("#", ""),
            description: description,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed to create the label "${name}": ${reason}`,
            );
          });

        const payload = mapGithubLabel(response.data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ created: true, label: payload }),
            },
          ],
        };
      }),
  );
};

export const createGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
