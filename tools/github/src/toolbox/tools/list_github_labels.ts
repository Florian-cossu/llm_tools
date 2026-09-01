import z from "zod";
import { ToolInstance } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
} from "@llm-tools/shared";
import { DEFAULT_LABEL_LIMIT } from "../../metadata.js";
import { GithubApiLabel, GithubCompactLabel } from "../../models/github_labels.js";
import { mapGithubLabel } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "list_github_labels";

export const listGithubLabels: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `List the labels of a github repository and return one page of ` +
        `them in a compact form: name, description, color and default. ` +
        `Returns {"returned": number, "truncated": boolean, ` +
        `"labels": [{"name", "description", "color", "default"}]}. ` +
        `"color" is a six-digit hex code without the leading "#". ` +
        `"default" is true for the labels GitHub creates with every ` +
        `repository. Unlike list_github_issues there is no total ` +
        `count: this endpoint does not report one. "truncated" is true when the ` +
        `page filled up and labels were left out - raise "limit", as there ` +
        `is no way to fetch a next page. Use this to discover the label names ` +
        `a list_github_issues search can filter on with label:"<name>".`,
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
            `Maximum number of labels to return, between 1 and 100. ` +
              `Defaults to ${DEFAULT_LABEL_LIMIT}. This is a single ` +
              `page and there is no way to fetch the next one, so raise ` +
              `this rather than expecting to paginate. Most repositories ` +
              `have few labels, so the default usually returns all of ` +
              `them.`,
          ),
      }),
    },
    async ({ owner, repository, limit }) => {
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
          const reason = error instanceof Error ? error.message : String(error);
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
    },
  );
};
