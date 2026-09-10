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
        `Create one new issue in a GitHub repository, always opened as ` +
        `"open" - there is no way to create an issue already closed. ` +
        `Unlike a label or a milestone, GitHub does not reject a ` +
        `duplicate title: calling this twice with the same title creates ` +
        `two separate issues, so confirm with the user before calling ` +
        `rather than retrying a call whose result is uncertain. This ` +
        `tool cannot set the issue's labels on creation - call ` +
        `update_github_issue with its "labels" parameter afterwards. ` +
        `Call list_github_issues first to check whether a similar ` +
        `issue already exists and to match the naming convention the ` +
        `repository already uses, and get_github_issue on a similar ` +
        `issue to match the phrasing and structure of the bodies it ` +
        `uses. Returns {"created": true, "issue": {"number", "title", ` +
        `"state", "body", "labels", "assignees", "milestone"}}, the ` +
        `same shape get_github_issue returns, read back from GitHub - ` +
        `"labels" is always empty on a new issue, since this tool ` +
        `cannot set them at creation time. The call fails when the ` +
        `configured token has ` +
        `no write access to the repository, or when "milestone_number" ` +
        `or an "assignees" login does not exist; none of those is ` +
        `retryable without changing the input.`,
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
            `The title identifying the new issue, exactly as it should ` +
              `appear in the GitHub interface. An issue title may contain ` +
              `spaces; pass it as it is, without quotes. Required, and ` +
              `never invented: use the title the user asked for. Unlike ` +
              `a label or a milestone title, GitHub does not check this ` +
              `for uniqueness - two issues in the same repository may ` +
              `share a title.`,
          ),

        body: z
          .string()
          .optional()
          .describe(
            `The body to give the issue: its description in Markdown, ` +
              `shown beneath its title in GitHub. Omit it to create the ` +
              `issue without a body. Call get_github_issue on a similar ` +
              `issue first to match the phrasing and structure of the ` +
              `bodies the repository already uses.`,
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
    async ({ owner, repository, title, body, milestone_number, assignees }) => withTracking("github", TOOL_NAME, async () => {
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
          const reason = error instanceof Error ? error.message : String(error);
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
