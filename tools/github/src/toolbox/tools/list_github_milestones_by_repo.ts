import { ToolInstance } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
} from "@llm-tools/shared";
import { mapGithubMilestone } from "../../mappers/github_compact_mappers.js";
import { GithubCompactMilestone } from "../../models/github_milestones.js";
import z from "zod";
import {
  DEFAULT_MILESTONE_LIMIT,
  DEFAULT_MILESTONE_STATE,
} from "../../metadata.js";

export const TOOL_NAME = "list_github_milestones_by_repo";

export const listGithubMilestonesByRepo: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `List the milestones of a GitHub repository and return one page of ` +
        `them in a compact form: number, title, state, description and due ` +
        `date. This is a plain listing rather than a search - there is no ` +
        `keyword filter, so narrow it with "state" and read the titles. ` +
        `Milestones group issues, but the issues themselves are not ` +
        `returned; to see what a milestone contains, call ` +
        `list_github_issues with a "search" of milestone:"<title>", using ` +
        `the "title" returned here. Returns {"returned": number, ` +
        `"truncated": boolean, "milestones": [{"number", "title", ` +
        `"state", "description", "dueOn"}]}, where "description" and ` +
        `"dueOn" are null when unset and "dueOn" is an ISO 8601 ` +
        `timestamp. Unlike list_github_issues there is no total count: ` +
        `this endpoint does not report one. "truncated" is true when the ` +
        `page filled up and milestones were left out - raise "limit", as ` +
        `there is no way to fetch a next page.`,
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
            `Maximum number of milestones to return, between 1 and 100. ` +
              `Defaults to ${DEFAULT_MILESTONE_LIMIT}. This is a single ` +
              `page and there is no way to fetch the next one, so raise ` +
              `this rather than expecting to paginate. Most repositories ` +
              `have few milestones, so the default usually returns all of ` +
              `them.`,
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
            `Sort direction: "desc" for the latest or highest first, ` +
              `"asc" for the earliest or lowest first. Defaults to ` +
              `"desc", which sorted by "due_on" puts the milestones due ` +
              `furthest in the future first; use "asc" to see what is due ` +
              `next.`,
          ),
      }),
    },
    async ({ owner, repository, state, limit, sortBy, sortOrder }) => {
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
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`${TOOL_NAME} failed for listMilestones: ${reason}`);
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
    },
  );
};
