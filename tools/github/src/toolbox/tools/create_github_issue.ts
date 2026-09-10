import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  describeMutation,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";
import { mapGithubIssue } from "../../mappers/github_compact_mappers.js";
import { GithubApiIssue } from "../../models/github_issues.js";

export const TOOL_NAME = "create_github_issue";

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
        `Create one issue, always opened as "open". ` +
        `Duplicate titles are allowed — confirm before calling; don't retry on uncertain outcome. ` +
        `Labels can't be set at creation time — use update_github_issue's "labels" param afterwards. ` +
        `Call list_github_issues first to check for duplicates and match naming conventions. ` +
        `Returns {created: true, issue: {...}} — same shape as get_github_issue. ` +
        `Fails when the token has no write access or "milestone_number"/"assignees" don't exist; not retryable.`,
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

        title: z
          .string()
          .min(1)
          .describe(
            `Title of the new issue, exactly as it should appear in GitHub. ` +
              `May contain spaces — pass as-is without quotes. ` +
              `Never invent: use the title the user asked for. ` +
              `Duplicates are allowed — GitHub doesn't enforce uniqueness on issue titles.`,
          ),

        body: z
          .string()
          .optional()
          .describe(
            `Issue description in Markdown. Omit to create issue without a body. ` +
              `Call get_github_issue on a similar issue first to match the repository's style.`,
          ),

        milestone_number: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `The number of the milestone to attach the new issue to, ` +
              `from list_github_milestones or get_github_milestone. ` +
              `Omit it to create the issue without a milestone.`,
          ),

        assignees: z
          .array(z.string())
          .optional()
          .describe(
            `The GitHub logins to assign to the new issue. Omit it to ` +
              `create the issue unassigned.`,
          ),
      }),
    },
    async ({ owner, repository, title, body, milestone_number, assignees }) =>
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
          .create({
            owner: effectiveOwner,
            repo: effectiveRepository,
            title: title,
            body: body,
            milestone: milestone_number,
            assignees: assignees,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed to create the issue "${title}": ${reason}`,
            );
          });

        const githubIssue = response.data as GithubApiIssue & {
          body?: string | null;
        };

        const payload = {
          created: true,
          issue: {
            ...mapGithubIssue(githubIssue),
            body: githubIssue.body ? githubIssue.body : null,
          },
        };

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

export const createGithubIssue: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
