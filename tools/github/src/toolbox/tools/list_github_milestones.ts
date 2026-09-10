import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
  withTracking,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";
import { GithubCompactMilestone } from "../../models/github_milestones.js";
import z from "zod";
import {
  DEFAULT_MILESTONE_LIMIT,
  DEFAULT_MILESTONE_STATE,
} from "../../metadata.js";

export const TOOL_NAME = "list_github_milestones";

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
        `List milestones in a GitHub repository; returns one page of results ` +
        `(number, title, state, description, dueOn). ` +
        `Plain listing — no keyword filter. ` +
        `To see a milestone's issues, call list_github_issues with "search" of milestone:"<title>".`,
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

        state: z
          .enum(["open", "closed", "all"])
          .default(DEFAULT_MILESTONE_STATE)
          .describe(
            `Which milestones to include. Defaults to ` +
              `"${DEFAULT_MILESTONE_STATE}". A closed milestone was shut ` +
              `by hand, whether or not every issue in it was finished, so ` +
              `"closed" does not mean "delivered". Use "all" to see past ` +
              `and current milestones together.`,
          ),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(DEFAULT_MILESTONE_LIMIT)
          .describe(
            `Max milestones to return, 1–100. Defaults to ${DEFAULT_MILESTONE_LIMIT}. ` +
              `No pagination — raise this if truncated. Most repos have few milestones.`,
          ),

        sortBy: z
          .enum(["due_on", "completeness"])
          .optional()
          .describe(
            `What to sort on: "due_on" (the milestone due date) or ` +
              `"completeness" (how many of its issues are closed). ` +
              `Omit this parameter to let GitHub sort by "due_on".`,
          ),

        sortOrder: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe(
            `Sort direction. Defaults to "desc" — with "due_on" puts furthest-future milestones first. ` +
              `Use "asc" to see what's due next.`,
          ),
      }),
    },
    async ({ owner, repository, state, limit, sortBy, sortOrder }) =>
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
          .listMilestones({
            owner: effectiveOwner,
            repo: effectiveRepository,
            state: state,
            per_page: limit,
            sort: sortBy,
            direction: sortOrder,
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `${TOOL_NAME} failed for listMilestones: ${reason}`,
            );
          });

        const compactMilestones: GithubCompactMilestone[] =
          response.data.map(mapGithubMilestone);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                returned: compactMilestones.length,
                // This endpoint reports no total, unlike search, so a full
                // page is the only signal that milestones were left out.
                truncated: compactMilestones.length === limit,
                milestones: compactMilestones,
              }),
            },
          ],
        };
      }),
  );
};

export const listGithubMilestones: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
