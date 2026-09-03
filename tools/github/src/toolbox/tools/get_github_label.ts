import z from "zod";
import { ToolInstance } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,
  isStringUsable,
  optionalWhenConfigured,
} from "@llm-tools/shared";
import { mapGithubLabel } from "../../mappers/github_compact_mappers.js";

export const TOOL_NAME = "get_github_label";

export const getGithubLabel: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +
        `Read a single label of a GitHub repository by its name, and ` +
        `confirm that the name exists. Call list_github_labels first ` +
        `when the name is not already known, or when the user's wording ` +
        `may not match a label exactly; this tool is the cheap ` +
        `follow-up once a name is certain, not a way to browse. ` +
        `Returns {"name", "description", "color", "default"}, where ` +
        `"description" is null when the label has none, "color" is a ` +
        `six-digit hex code without the leading "#", and "default" is ` +
        `true for the labels GitHub creates with every repository. ` +
        `That is the same shape list_github_labels returns for each ` +
        `label: there is no further detail behind a label, so call this ` +
        `to check one name rather than to learn more about a label ` +
        `already listed. The issues carrying the label are not ` +
        `returned - list them with list_github_issues and a "labels" of ` +
        `"<name>". The call fails when the repository has no label with ` +
        `this name, which is itself the answer to "does this label ` +
        `exist?".`,
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

        name: z
          .string()
          .describe(
            `The name identifying the label within its repository, ` +
              `exactly as shown in the GitHub interface and returned in ` +
              `the "name" field of list_github_labels results. A label ` +
              `name may contain spaces; pass it as it is, without ` +
              `quotes.`,
          ),
      }),
    },
    async ({ owner, repository, name }) => {
      const effectiveOwner = owner?.trim() || config.defaultOwner;
      const effectiveRepository = repository?.trim() || config.defaultRepository;

      if (
        !isStringUsable(effectiveOwner) ||
        !isStringUsable(effectiveRepository)
      ) {
        throw new Error(
          "No GitHub owner or repository was provided, and no default was configured.",
        );
      }

      const response = await config.octokit.rest.issues
        .getLabel({
          owner: effectiveOwner,
          repo: effectiveRepository,
          name: name,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Unable to retrieve label "${name}": ${reason}`);
        });

      const payload = mapGithubLabel(response.data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      };
    },
  );
};
