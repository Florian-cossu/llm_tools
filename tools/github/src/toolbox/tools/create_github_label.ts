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
        `Create one new label in a GitHub repository. A second call with ` +
        `the same name fails rather than doing nothing, so a failure here ` +
        `is not a reason to retry. Call list_github_labels with a ` +
        `"limit" of 10 first, both to check that no existing label ` +
        `already covers the need and to follow the naming and wording ` +
        `conventions the repository already uses. Returns ` +
        `{"created": true, "label": {"name", "description", "color", ` +
        `"default"}}, the same label shape list_github_labels and ` +
        `get_github_label return, read back from GitHub - "description" ` +
        `is null when none was given, "color" is a six-digit hex code ` +
        `without the leading "#", and "default" is false for every label ` +
        `created this way. The new label carries no issues: nothing is ` +
        `labelled by creating it, and no tool on this server can apply a ` +
        `label to an issue - say so rather than implying the issues were ` +
        `updated. The call fails when the repository already has a label ` +
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

        name: z
          .string()
          .min(1)
          .describe(
            `The name identifying the new label within its repository, ` +
              `exactly as it should appear in the GitHub interface. A ` +
              `label name may contain spaces; pass it as it is, without ` +
              `quotes. Required, and never invented: use the name the ` +
              `user asked for, matched to the prefix, case and separator ` +
              `of the names list_github_labels returns. GitHub compares ` +
              `names case-insensitively, so "Bug" collides with an ` +
              `existing "bug" and the call fails.`,
          ),

        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
          .describe(
            `The colour of the label as a six-digit hexadecimal code, ` +
              `with or without a leading "#": "d73a4a" and "#d73a4a" are ` +
              `both accepted and both stored as "d73a4a", the form ` +
              `list_github_labels returns. Three-digit shorthand and ` +
              `colour names such as "red" are rejected. Omit it to let ` +
              `GitHub pick a colour rather than guessing one, and ask the ` +
              `user when the colour matters.`,
          ),

        description: z
          .string()
          .max(100)
          .optional()
          .describe(
            `A short sentence saying what the label is for, shown beside ` +
              `it in GitHub, at most 100 characters - GitHub rejects ` +
              `longer ones. Omit it rather than restating the name. Call ` +
              `list_github_labels with a "limit" of 10 to match the ` +
              `phrasing of the descriptions the repository already uses.`,
          ),
      }),
    },
    async ({ owner, repository, name, color, description }) => {
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

      const response = await config.octokit.rest.issues
        .createLabel({
          owner: effectiveOwner,
          repo: effectiveRepository,
          name: name,
          color: color?.replace("#", ""),
          description: description,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
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
    },
  );
};

export const createGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
