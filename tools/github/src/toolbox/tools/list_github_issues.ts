import z from "zod";
import { DEFAULT_ISSUE_LIMIT, DEFAULT_ISSUE_STATE } from "../../metadata.js";
import { ToolInstance, ToolRegistration } from "../index.js";
import { buildIssueSearchQuery } from "../../utils/github_search_query.js";
import { mapGithubIssue } from "../../mappers/github_compact_mappers.js";
import {
  GithubApiIssue,
  GithubCompactIssue,
} from "../../models/github_issues.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";

export const TOOL_NAME = "list_github_issues";

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
        `Search issues in a GitHub repository; returns one page of compact results ` +
        `(number, title, state, labels, assignees, milestone). Pull requests excluded. ` +
        `Body and comments not included — use get_github_issue for those. ` +
        `Narrow before listing: use "labels" to filter by label and "search" for ` +
        `keywords or qualifiers. totalCount may exceed returned when the page is truncated. ` +
        `Rate limited to ~30 calls/min — prefer one targeted search over many broad ones.`,
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

        search: z
          .string()
          .optional()
          .describe(
            `GitHub issue search syntax. Bare words match title/body/comments. ` +
              `Qualifiers narrow further: "author:X", "assignee:@me", "no:assignee", ` +
              `"created:>2026-01-01". "@me" resolves to the configured account. ` +
              `Repo, state, labels and PR exclusion are applied for you — don't repeat them. ` +
              `Omit to match all issues.`,
          ),

        labels: z
          .string()
          .optional()
          .describe(
            `Comma-separated label names to require or exclude. ` +
              `Prefix with "NOT:" to exclude: "bug,NOT:wontfix" keeps "bug" issues except those also labelled "wontfix". ` +
              `Multiple include-names match issues carrying ANY of them. ` +
              `Unknown names match nothing silently — call list_github_labels first. ` +
              `Omit to match regardless of labels.`,
          ),

        state: z
          .enum(["open", "closed", "all"])
          .default(DEFAULT_ISSUE_STATE)
          .describe(
            `Which issues to include. Defaults to ` +
              `"${DEFAULT_ISSUE_STATE}". A closed issue may have been ` +
              `completed or dismissed as not planned; this tool does not ` +
              `distinguish the two.`,
          ),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(DEFAULT_ISSUE_LIMIT)
          .describe(
            `Max issues to return, 1–100. Defaults to ${DEFAULT_ISSUE_LIMIT}. ` +
              `No pagination — raise this instead of expecting a next page.`,
          ),

        sortBy: z
          .enum(["created", "updated", "comments"])
          .default("updated")
          .describe(
            `What to sort on: "created" (when the issue was opened), ` +
              `"updated" (last activity, comments included) or ` +
              `"comments" (comment count). Defaults to "updated".`,
          ),

        sortOrder: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe(
            `Sort direction: "desc" for the most recent or highest ` +
              `first, "asc" for the oldest or lowest first. Defaults to ` +
              `"desc", which with the default sortBy puts the most ` +
              `recently active issues first.`,
          ),
      }),
    },
    async ({
      owner,
      repository,
      search,
      state,
      labels,
      limit,
      sortBy,
      sortOrder,
    }) =>
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

        const cleanLabelRegEx = /\s*,\s*/g;
        const cleanedLabels = labels?.trim()?.replace(cleanLabelRegEx, ",");

        const query = buildIssueSearchQuery({
          owner: effectiveOwner,
          repository: effectiveRepository,
          state,
          search,
          labels: cleanedLabels,
        });

        const response = await config.octokit.rest.search
          .issuesAndPullRequests({
            q: query,
            advanced_search: "true",
            sort: sortBy,
            order: sortOrder,
            per_page: limit,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(`GitHub rejected the search "${query}": ${reason}`);
          });

        const githubIssues = response.data.items as GithubApiIssue[];

        const compactIssues: GithubCompactIssue[] =
          githubIssues.map(mapGithubIssue);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                totalCount: response.data.total_count,
                returned: compactIssues.length,
                // Set by GitHub when the search timed out and the results
                // are a partial view of what matches.
                ...(response.data.incomplete_results
                  ? { incompleteResults: true }
                  : {}),
                issues: compactIssues,
              }),
            },
          ],
        };
      }),
  );
};

export const listGithubIssuesTool: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
