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

export const TOOL_NAME = "update_github_issue";

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
        `Change the title, body, state, milestone or assignees of one issue ` +
        `that already exists in the repository. The issue is identified by ` +
        `"number"; every other parameter is a new value, and one left out ` +
        `is left unchanged - so pass only the fields the user asked to ` +
        `change rather than resending the whole issue. At least one of ` +
        `"title", "body", "state", "milestone_number" or "assignees" is ` +
        `required: a call carrying none of them is rejected rather than ` +
        `treated as a no-op. "assignees" replaces the issue's whole ` +
        `assignee list rather than adding to it - pass every login who ` +
        `should remain assigned, not only the new one. This tool cannot ` +
        `change an issue's labels - no tool on this server can. Call ` +
        `get_github_issue first to confirm the issue exists and to match ` +
        `the phrasing and structure of the bodies the repository already ` +
        `uses. Returns {"updated": true, "issue": {"number", "title", ` +
        `"state", "body", "labels", "assignees", "milestone"}}, the same ` +
        `shape get_github_issue returns, read back from GitHub after the ` +
        `change. The call fails when the repository has no issue numbered ` +
        `"number", and when the configured token has no write access to ` +
        `the repository; neither is retryable without changing the input.`,
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
            `The number identifying the issue to update, as shown in the ` +
              `GitHub interface and returned in the "number" field of ` +
              `list_github_issues results. Required, and never invented: ` +
              `take it from list_github_issues or get_github_issue rather ` +
              `than from the user's wording, as the call fails when no ` +
              `issue carries this number.`,
          ),

        title: z
          .string()
          .optional()
          .describe(
            `The title to give the issue instead, exactly as it should ` +
              `appear in the GitHub interface. Omit it to leave the title ` +
              `as it is - most edits change only the state or the body. An ` +
              `issue title may contain spaces; pass it as it is, without ` +
              `quotes. Match the prefix, case and separator of the titles ` +
              `list_github_issues returns.`,
          ),

        body: z
          .string()
          .optional()
          .describe(
            `The body to give the issue instead: the issue's description ` +
              `in Markdown, shown beneath its title in GitHub. Omit it to ` +
              `leave the body as it is; pass an empty string to clear it. ` +
              `Call get_github_issue on a similar issue first to match the ` +
              `phrasing and structure of the bodies the repository already ` +
              `uses.`,
          ),

        state: z
          .enum(["open", "closed"])
          .optional()
          .describe(
            `The status to give the issue instead. A closed issue may ` +
              `have been completed or dismissed as not planned; this tool ` +
              `does not distinguish the two.`,
          ),

        milestone_number: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `The number of the milestone to attach the issue to instead, ` +
              `from list_github_milestones or get_github_milestone. Omit ` +
              `it to leave the issue's milestone as it is. There is no way ` +
              `to clear an issue's milestone with this tool once one is ` +
              `set.`,
          ),

        assignees: z
          .array(z.string())
          .optional()
          .describe(
            `The full list of GitHub logins who should be assigned to the ` +
              `issue instead, replacing the current assignees rather than ` +
              `adding to them - include everyone who should remain ` +
              `assigned, not only whoever is new. Omit it to leave the ` +
              `assignees as they are; pass an empty array to unassign ` +
              `everyone.`,
          ),
      }),
    },
    async ({
      owner,
      repository,
      number,
      title,
      body,
      state,
      milestone_number,
      assignees,
    }) => withTracking("github", TOOL_NAME, async () => {
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

      if (
        title === undefined &&
        body === undefined &&
        state === undefined &&
        milestone_number === undefined &&
        assignees === undefined
      ) {
        throw new Error(
          `${TOOL_NAME} was called with nothing to change: pass at least one of "title", "body", "state", "milestone_number" or "assignees".`,
        );
      }

      const response = await config.octokit.rest.issues
        .update({
          owner: effectiveOwner,
          repo: effectiveRepository,
          issue_number: number,
          title: title,
          body: body,
          state: state,
          milestone: milestone_number,
          assignees: assignees,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `${TOOL_NAME} failed to update issue "${number}": ${reason}`,
          );
        });

      const githubIssue = response.data as GithubApiIssue & {
        body?: string | null;
      };

      const payload = {
        updated: true,
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

export const updateGithubIssue: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
