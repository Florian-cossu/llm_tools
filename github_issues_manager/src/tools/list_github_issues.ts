import * as z from "zod/v4";

import {
  ANY_ASSIGNEE_SENTINEL,
  CURRENT_USER_SENTINEL,
  DEFAULT_ISSUE_LIMIT,
  DEFAULT_ISSUE_STATE,
  NO_ASSIGNEE_SENTINEL,
} from "../metadata.js";
import { githubRequest } from "../github/client.js";
import {
  resolveAssignee,
  resolveRepositoryTarget,
} from "../github/resolvers.js";
import {
  GithubApiIssue,
  mapGithubIssue,
} from "../mappers/github_compact_mappers.js";
import type { GithubCompactIssue } from "../models/github_issues.js";
import { describeDefault } from "../utils/tool_descriptions.js";
import type { ToolRegistrar } from "./tool_registrar.js";

export const TOOL_NAME = "list_github_issues";

export const registerListGithubIssuesTool: ToolRegistrar = (
  server,
  config,
) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        `List issues of a GitHub repository in a compact form: number, ` +
        `title, state, labels, assignee logins and milestone. Pull ` +
        `requests are excluded. Issue bodies and comments are not ` +
        `returned, so use this tool to survey or search issues, not to ` +
        `read their content. Owner and repository fall back to the values ` +
        `configured on this server, so never ask the user for them.`,
      inputSchema: z.object({
        assignee: z
          .string()
          .optional()
          .describe(
            `Filter by a single assignee. Pass ` +
              `"${CURRENT_USER_SENTINEL}" whenever the user refers to ` +
              `themselves ("my issues", "issues assigned to me") — the ` +
              `server substitutes the configured GitHub login. Pass a ` +
              `GitHub login to filter by that person, ` +
              `"${NO_ASSIGNEE_SENTINEL}" for unassigned issues only, or ` +
              `"${ANY_ASSIGNEE_SENTINEL}" for issues assigned to anyone. ` +
              `Omit this parameter to list issues regardless of assignee. ` +
              `Only one value is supported: to cover several people, call ` +
              `this tool once per login.`,
          ),

        owner: z
          .string()
          .optional()
          .describe(
            `GitHub repository owner (user or organisation), for example ` +
              `DiabdataApp. ` +
              describeDefault(
                config.defaultOwner,
                `Required, as no default owner is configured on this ` +
                  `server.`,
              ),
          ),

        repository: z
          .string()
          .optional()
          .describe(
            `GitHub repository name without its owner, for example ` +
              `diab-data-android. ` +
              describeDefault(
                config.defaultRepository,
                `Required, as no default repository is configured on this ` +
                  `server.`,
              ),
          ),

        state: z
          .enum(["open", "closed", "all"])
          .default(DEFAULT_ISSUE_STATE)
          .describe(
            `Which issues to include: "open" for issues still to be ` +
              `worked on, "closed" for issues already resolved, "all" for ` +
              `both. Defaults to "${DEFAULT_ISSUE_STATE}".`,
          ),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(DEFAULT_ISSUE_LIMIT)
          .describe(
            `Maximum number of issues to fetch, from 1 to 100, most ` +
              `recently updated first. Defaults to ` +
              `${DEFAULT_ISSUE_LIMIT}. Fewer issues may be returned, ` +
              `since pull requests are filtered out of the results.`,
          ),
      }),
    },
    async ({ assignee, owner, repository, state, limit }) => {
      const target = resolveRepositoryTarget(config, owner, repository);
      const resolvedAssignee = resolveAssignee(config, assignee);

      const query = new URLSearchParams({
        state,
        per_page: String(limit),
        sort: "updated",
        direction: "desc",
      });

      // Sent only when set: GitHub rejects an empty `assignee` with a 422.
      if (resolvedAssignee !== null) {
        query.set("assignee", resolvedAssignee);
      }

      const githubIssues = await githubRequest<GithubApiIssue[]>(
        config,
        `${target.path}/issues`,
        query,
      );

      const compactIssues: GithubCompactIssue[] = githubIssues
        .filter((issue) => !issue.pull_request)
        .map(mapGithubIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                repo: target.slug,
                state,
                assignee: resolvedAssignee,
                count: compactIssues.length,
                issues: compactIssues,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
};
