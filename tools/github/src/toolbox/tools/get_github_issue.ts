import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import { mapGithubIssue } from "../../mappers/github_compact_mappers.js";
import { GithubApiIssue } from "../../models/github_issues.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";

export const TOOL_NAME = "get_github_issue";

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
        `Read one issue by number, including the body omitted by list_github_issues. ` +
        `Comments not included. Use list_github_issues first if the number is unknown. ` +
        `Returns {number, title, state, body, labels, assignees, milestone}.`,
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

        number: z
          .number()
          .int()
          .positive()
          .describe(
            `Issue number as shown in GitHub and returned by list_github_issues. ` +
              `Never invented — take it from list_github_issues or get_github_issue; the call fails if it doesn't exist.`,
          ),
      }),
    },
    async ({ owner, repository, number }) =>
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
          .get({
            owner: effectiveOwner,
            repo: effectiveRepository,
            issue_number: number,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to retrieve issue "${number}": ${reason}`);
          });

        const githubIssue = response.data as GithubApiIssue & {
          body?: string | null;
        };

        const compactIssue = {
          ...mapGithubIssue(githubIssue),
          body: githubIssue.body ? githubIssue.body : null,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(compactIssue),
            },
          ],
        };
      }),
  );
};

export const getGithubIssue: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
