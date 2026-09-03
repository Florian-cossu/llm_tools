import z from "zod";
import { DEFAULT_ISSUE_LIMIT, DEFAULT_ISSUE_STATE } from "../../metadata.js";
import { ToolInstance } from "../index.js";
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
} from "@llm-tools/shared";

export const TOOL_NAME = "list_github_issues";

export const listGithubIssuesTool: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Search the issues of a GitHub repository and return one page of ` +
        `matches in a compact form: number, title, state, label names, ` +
        `assignee logins and milestone. Pull requests are never ` +
        `included. Issue bodies and comments are not returned, so this ` +
        `tool shows which issues exist, not what they say; read one with ` +
        `get_github_issue, passing the "number" it returned here. Narrow ` +
        `the results before asking for them rather than listing ` +
        `everything and filtering afterwards: use the "labels" parameter ` +
        `to require or exclude labels, and the "search" parameter for ` +
        `keywords, author, assignee or date. Returns {"totalCount": number, ` +
        `"returned": number, "issues": [{"number", "title", "state", ` +
        `"labels", "assignees", "milestone"}]}, where "totalCount" is ` +
        `how many issues match in the repository and "returned" is how ` +
        `many are in this page - when they differ, the page is ` +
        `truncated and only "totalCount" may be reported as a total. ` +
        `This tool is rate limited to about 30 calls per minute, so ` +
        `prefer one well-targeted search over many broad ones.`,
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
            `What to look for, as GitHub issue search syntax. Bare ` +
              `words match the title, body and comments; GitHub ` +
              `qualifiers narrow further, for example ` +
              `"author:octocat", "assignee:@me", "no:assignee", ` +
              `"milestone:v2" or "created:>2026-01-01". Combine them ` +
              `with spaces to require all of them, and quote phrases ` +
              `containing spaces. "@me" resolves to the account this ` +
              `server is configured with, so "my issues" means ` +
              `"assignee:@me" and needs no question to the user. Omit ` +
              `this parameter to match every ` +
              `issue in the repository. Filter by label with the ` +
              `"labels" parameter instead of a "label:" qualifier ` +
              `here. The repository, the state, the labels and the ` +
              `exclusion of pull requests are applied for you, so do ` +
              `not repeat them here.`,
          ),

        labels: z
          .string()
          .optional()
          .describe(
            `Which labels an issue must or must not carry, as a ` +
              `comma-separated list of label names. A name on its own ` +
              `keeps issues carrying that label; a name prefixed with ` +
              `"NOT:" drops issues carrying it. For example ` +
              `"draft,NOT:documentation" returns issues labelled ` +
              `"draft" except those also labelled "documentation". ` +
              `Listing several names to keep matches issues carrying ` +
              `ANY of them, not all of them; to require two labels at ` +
              `once, filter on one here and read the "labels" field of ` +
              `the results. Use the exact names GitHub shows, spaces ` +
              `and capitalisation included - call list_github_labels ` +
              `first when they are not already known, as an unknown ` +
              `name matches no issue rather than failing. Do not add ` +
              `quotes and do not write the "label:" qualifier: both are ` +
              `applied for you. Omit this parameter to match issues ` +
              `whatever their labels.`,
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
            `Maximum number of issues to return, between 1 and 100. ` +
              `Defaults to ${DEFAULT_ISSUE_LIMIT}. This is a single ` +
              `page and there is no way to fetch the next one, so raise ` +
              `this rather than expecting to paginate.`,
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
    }) => {
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
          const reason = error instanceof Error ? error.message : String(error);
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
    },
  );
};
