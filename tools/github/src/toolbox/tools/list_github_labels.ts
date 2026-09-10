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
import { DEFAULT_LABEL_LIMIT } from "../../metadata.js";
import {
  GithubApiLabel,
  GithubCompactLabel,
} from "../../models/github_labels.js";
import { mapGithubLabel } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "list_github_labels";

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
        `List labels in a GitHub repository; returns one page of results ` +
        `(name, description, color, default). ` +
        `Use to discover label names before filtering list_github_issues ` +
        `or applying labels via update_github_issue.`,
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

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(DEFAULT_LABEL_LIMIT)
          .describe(
            `Max labels to return, 1–100. Defaults to ${DEFAULT_LABEL_LIMIT}. ` +
              `No pagination — raise this if truncated. Most repos have few labels.`,
          ),
      }),
    },
    async ({ owner, repository, limit }) =>
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
          .listLabelsForRepo({
            owner: effectiveOwner,
            repo: effectiveRepository,
            per_page: limit,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(`${TOOL_NAME} failed: ${reason}`);
          });

        const githubLabels = response.data as GithubApiLabel[];

        const compactLabels: GithubCompactLabel[] =
          githubLabels.map(mapGithubLabel);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                returned: compactLabels.length,
                truncated: compactLabels.length === limit,
                labels: compactLabels,
              }),
            },
          ],
        };
      }),
  );
};

export const listGithubLabels: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
