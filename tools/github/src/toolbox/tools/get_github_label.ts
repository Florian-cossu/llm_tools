import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";
import { mapGithubLabel } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "get_github_label";

export const TOOL_EFFECT: ToolEffect = "read";

const register: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Read one label by its exact name. Use list_github_labels first ` +
        `if the name is unknown or the user's wording may not match exactly. ` +
        `Returns {"name", "description", "color", "default"}.`,
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
          .describe(
            `The name identifying the label within its repository, ` +
              `exactly as shown in the GitHub interface and returned in ` +
              `the "name" field of list_github_labels results. A label ` +
              `name may contain spaces; pass it as it is, without ` +
              `quotes.`,
          ),
      }),
    },
    async ({ owner, repository, name }) =>
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
          .getLabel({
            owner: effectiveOwner,
            repo: effectiveRepository,
            name: name,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to retrieve label "${name}": ${reason}`);
          });

        const payload = mapGithubLabel(response.data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload),
            },
          ],
        };
      }),
  );
};

export const getGithubLabel: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
