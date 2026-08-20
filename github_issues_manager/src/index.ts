import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import {
  APP_NAME,
  APP_VERSION,
  GITHUB_API_BASE_URL,
  DEFAULT_ISSUE_STATE,
  DEFAULT_ISSUE_LIMIT,
} from "./metadata.js";
import {
  GithubApiIssue,
  mapGithubIssue,
} from "./mappers/github_compact_mappers.js";
import { GithubCompactIssue } from "./models/github_issues.js";

const server = new McpServer({
  name: APP_NAME,
  version: APP_VERSION,
});

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const githubToken = process.env.GITHUB_TOKEN;
const DEFAULT_OWNER = process.env.GITHUB_DEFAULT_OWNER ?? null;
const DEFAULT_REPO = process.env.GITHUB_DEFAULT_REPOSITORY ?? null;

/**
 * You can test the tools locally by running the following:
 *
 * ```bash
 *  npx @modelcontextprotocol/inspector npx tsx src/index.ts
 * ```
 *
 * Once you have satisfying results you can then build the js
 * to use in your tool (LM Studio for example) by pointing the MCP
 * server to the dist folder
 *
 * ```bash
 *  npm run build
 * ```
 *
 */
server.registerTool(
  "list_github_issues",
  {
    description:
      `List GitHub issues using ${APP_NAME} v${APP_VERSION}. ` +
      `If the user does not specify an owner or repository, ` +
      `the configured default repository will be used instead. ` +
      `Do not ask for owner or repository.`,
    inputSchema: z.object({
      owner: z
        .string()
        .optional()
        .describe(
          "GitHub repository owner, for example DiabdataApp. Defaults to the configured owner if omitted.",
        ),

      repository: z
        .string()
        .optional()
        .describe(
          "GitHub repository name, for example diab-data-android. Defaults to the configured repository if omitted.",
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
    const effectiveOwner = owner?.trim() || DEFAULT_OWNER;

    const effectiveRepository = repository?.trim() || DEFAULT_REPO;

    if (!effectiveOwner || !effectiveRepository) {
      throw new Error(
        "No GitHub owner or repository was provided, and no default was configured.",
      );
    }

    const encodedOwner = encodeURIComponent(effectiveOwner);
    const encodedRepository = encodeURIComponent(effectiveRepository);

    const query = new URLSearchParams({
      state,
      per_page: String(limit),
      sort: "updated",
      direction: "desc",
    });

    const queryUrl =
      `${GITHUB_API_BASE_URL}/repos/` +
      `${encodedOwner}/${encodedRepository}/issues?${query}`;

    const response = await fetch(queryUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(githubToken
          ? {
              Authorization: `Bearer ${githubToken}`,
            }
          : {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `GitHub API error: ${response.status}\n` +
          `URL: ${queryUrl}\n` +
          `Response: ${errorBody}`,
      );
    }

    const githubIssues = (await response.json()) as GithubApiIssue[];

    const compactIssues: GithubCompactIssue[] = githubIssues
      .filter((issue) => !issue.pull_request)
      .map(mapGithubIssue);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              effectiveOwner,
              effectiveRepository,
              state,
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

const transport = new StdioServerTransport();
await server.connect(transport);
