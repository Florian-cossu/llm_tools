import z from "zod";
import { DEFAULT_ISSUE_LIMIT, DEFAULT_ISSUE_STATE } from "../../metadata.js";
import { ToolInstance } from "../index.js";
import { Octokit } from "octokit";
import { isStringUsable } from "../../utils/string_utils.js";
import {
  GithubApiIssue,
  mapGithubIssue,
} from "../../mappers/github_compact_mappers.js";
import { GithubCompactIssue } from "../../models/github_issues.js";

export const TOOL_NAME = "list_github_issues";

export const listGithubIssuesByRepoTool: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        `List GitHub issues using ${config.serverName} v${config.serverVersion} ` +
        `in a condensed format (issue number, title, state, labes, assignees and milestone)` +
        `If the user does not specify a owner or repository, ` +
        `the configured default repository will be used instead. ` +
        `Do not ask for owner or repository.`,
      inputSchema: z.object({
        owner: z
          .string()
          .optional()
          .describe(
            "GitHub repository owner. Defaults to the configured owner if omitted.",
          ),

        repository: z
          .string()
          .optional()
          .describe(
            "GitHub repository name. Defaults to the configured repository if omitted.",
          ),

        state: z
          .enum(["open", "closed", "all"])
          .default(DEFAULT_ISSUE_STATE)
          .describe("Filter issues by state"),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(DEFAULT_ISSUE_LIMIT)
          .describe("Maximum number of issues to return"),
      }),
    },
    async ({ owner, repository, state, limit }) => {
      const octokit = new Octokit({ auth: config.token });

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

      const response = await octokit.rest.issues.listForRepo({
        owner: effectiveOwner,
        repo: effectiveRepository,
        state,
        per_page: limit,
        sort: "updated",
        direction: "desc",
      });

      if (response.status !== 200) {
        throw new Error(`GitHub API error: ${response.status}\n`);
      }

      const githubIssues = (await response.data) as GithubApiIssue[];

      const compactIssues: GithubCompactIssue[] = githubIssues
        .filter((issue) => !issue.pull_request)
        .map(mapGithubIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: compactIssues.length,
                issues: compactIssues,
              },
            ),
          },
        ],
      };
    },
  );
};
