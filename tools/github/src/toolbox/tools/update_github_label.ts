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
        `Change the name, colour or description of one label that ` +
        `already exists in a GitHub repository. The label is identified ` +
        `by "name", its current name; every other parameter is a new ` +
        `value, and one left out is left unchanged - so pass only the ` +
        `fields the user asked to change rather than resending the ` +
        `whole label. At least one of "newName", "color" and ` +
        `"description" is required: a call carrying none of them is ` +
        `rejected rather than treated as a no-op. Call ` +
        `list_github_labels with a "limit" of 10 first, both to confirm ` +
        `the label exists under the exact name being passed and to ` +
        `follow the naming and wording conventions the repository ` +
        `already uses. Returns {"updated": true, "label": {"name", ` +
        `"description", "color", "default"}}, the same label shape ` +
        `list_github_labels and get_github_label return, read back from ` +
        `GitHub after the change - "description" is null when the label ` +
        `has none, and "color" is a six-digit hex code without the ` +
        `leading "#". Renaming a label keeps it on the issues that ` +
        `carry it: those issues now show the new name, and no issue ` +
        `gains or loses the label. Nothing else about the issues ` +
        `changes, and no tool on this server can apply a label to an ` +
        `issue - say so rather than implying the issues were edited. ` +
        `The call fails when the repository has no label called "name", ` +
        `when "newName" collides with a label that already exists, and ` +
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

        name: z
          .string()
          .min(1)
          .describe(
            `The current name of the label to change, exactly as shown ` +
              `in the GitHub interface and returned in the "name" field ` +
              `of list_github_labels results. This says which label is ` +
              `edited and is never itself the new name - rename with ` +
              `"newName". A label name may contain spaces; pass it as it ` +
              `is, without quotes. Required, and never invented: take it ` +
              `from list_github_labels rather than from the user's ` +
              `wording, as the call fails when no label carries this ` +
              `name.`,
          ),

        newName: z
          .string()
          .min(1)
          .optional()
          .describe(
            `The name to give the label instead, exactly as it should ` +
              `appear in the GitHub interface. Omit it to leave the name ` +
              `as it is - most edits change only the colour or the ` +
              `description. A label name may contain spaces; pass it as ` +
              `it is, without quotes. Match the prefix, case and ` +
              `separator of the names list_github_labels returns. GitHub ` +
              `compares names case-insensitively, so renaming to "Bug" ` +
              `collides with an existing "bug" and the call fails.`,
          ),

        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
          .describe(
            `The colour to give the label instead, as a six-digit ` +
              `hexadecimal code, with or without a leading "#": ` +
              `"d73a4a" and "#d73a4a" are both accepted and both stored ` +
              `as "d73a4a", the form list_github_labels returns. ` +
              `Three-digit shorthand and colour names such as "red" are ` +
              `rejected. Omit it to leave the colour as it is, and ask ` +
              `the user for a code rather than guessing one when the ` +
              `colour matters.`,
          ),

        description: z
          .string()
          .max(100)
          .optional()
          .describe(
            `The description to give the label instead: a short sentence ` +
              `saying what the label is for, shown beside it in GitHub, ` +
              `at most 100 characters - GitHub rejects longer ones. Omit ` +
              `it to leave the description as it is; pass an empty ` +
              `string to clear it. Call list_github_labels with a ` +
              `"limit" of 10 to match the phrasing of the descriptions ` +
              `the repository already uses.`,
          ),
      }),
    },
    async ({ owner, repository, name, newName, color, description }) => {
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
          const reason = error instanceof Error ? error.message : String(error);
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
    },
  );
};

export const updateGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
