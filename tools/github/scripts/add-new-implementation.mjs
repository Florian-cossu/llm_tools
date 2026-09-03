#!/usr/bin/env node

/**
 * Scaffolds a new tool implementation inside the GitHub toolbox and
 * registers it in `toolbox/index.ts`.
 *
 * Usage: node tools/github/scripts/add-new-implementation.mjs <tool_name> [--description "..."]
 *
 * Example: node tools/github/scripts/add-new-implementation.mjs close_github_issue
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../../..");
const TOOLBOX_DIR = resolve(REPO_ROOT, "tools/github/src/toolbox");
const TOOLS_DIR = resolve(TOOLBOX_DIR, "tools");
const TOOLBOX_INDEX = resolve(TOOLBOX_DIR, "index.ts");

const log = (msg = "") => process.stderr.write(`${msg}\n`);
const fail = (msg) => {
  log(`Error: ${msg}`);
  process.exit(1);
};
const write = (path, content) => {
  writeFileSync(path, content, "utf8");
  log(`  created ${relative(REPO_ROOT, path)}`);
};

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    description: { type: "string", default: "" },
    effect: { type: "string", default: "read" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (flags.help || positionals.length === 0) {
  log(`
Add a new tool implementation to the GitHub toolbox.

  node tools/github/scripts/add-new-implementation.mjs <tool_name> [options]

Options
  --description "..."   First sentence of the tool description
  --effect read|write   What the tool does upstream (default: read). A write
                        tool is registered only when GITHUB_ALLOW_WRITES is
                        set. "destructive" is rejected: see ADR-0007.
  -h, --help            Show this help

Example
  node tools/github/scripts/add-new-implementation.mjs create_github_comment \\
    --effect write \\
    --description "Add a comment to a single issue of a GitHub repository."
`);
  process.exit(0);
}

/**
 * Tool names are snake_case, matching the names the MCP client sees.
 * Dashes and spaces are folded into underscores so that either style of
 * argument produces the same file.
 */
const toolName = positionals[0]
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

if (!toolName) {
  fail(`"${positionals[0]}" contains no usable characters for a tool name.`);
}

/** `close_github_issue` -> `closeGithubIssue` */
const exportName = toolName
  .split("_")
  .map((segment, index) =>
    index === 0 ? segment : segment[0].toUpperCase() + segment.slice(1),
  )
  .join("");

const toolFile = resolve(TOOLS_DIR, `${toolName}.ts`);

if (existsSync(toolFile)) {
  fail(`${relative(REPO_ROOT, toolFile)} already exists.`);
}
if (!existsSync(TOOLS_DIR)) {
  fail(`${relative(REPO_ROOT, TOOLS_DIR)} does not exist.`);
}

/**
 * The effect class, declared up front because it decides the shape of the
 * scaffold: a write tool opens its description with `describeMutation`.
 * `destructive` is refused here rather than at startup, so the mistake is
 * caught before a file exists (ADR-0007 D3).
 */
const effect = flags.effect.trim().toLowerCase();

if (effect === "destructive") {
  fail(
    `no tool may declare the "destructive" effect yet - see ` +
      `docs/03-decisions/ADR-0007-writes-behind-declared-capability.md.`,
  );
}
if (effect !== "read" && effect !== "write") {
  fail(`--effect must be "read" or "write", not "${flags.effect}".`);
}

const description =
  flags.description ||
  `TODO: describe what ${toolName} returns and when to call it.`;

log(`\nAdding tool: ${toolName}`);
log(`  Export:    ${exportName}`);
log(`  Effect:    ${effect}`);
if (effect === "write") {
  log(`  Note:      registered only when GITHUB_ALLOW_WRITES is set`);
}
log("");

write(
  toolFile,
  `import z from "zod";
import { ToolInstance, ToolRegistration } from "../index.js";
import {
  describeConfiguredRepository,
  describeDefault,${effect === "write" ? "\n  describeMutation," : ""}
  isStringUsable,
  optionalWhenConfigured,
  ToolEffect,
} from "@llm-tools/shared";

export const TOOL_NAME = "${toolName}";

export const TOOL_EFFECT: ToolEffect = "${effect}";

const register: ToolInstance = (server, config) => {
  server.registerTool(
    TOOL_NAME,
    {
      description:
        describeConfiguredRepository(
          config.defaultOwner,
          config.defaultRepository,
        ) +${effect === "write" ? "\n        describeMutation(TOOL_EFFECT) +" : ""}
        \`${description.replace(/[\\`$]/g, "\\$&")}\`,
      inputSchema: z.object({
        owner: optionalWhenConfigured(config.defaultOwner).describe(
          "GitHub repository owner (user or organisation). " +
            describeDefault(
              config.defaultOwner,
              \`Required, as no default owner is configured on this \` +
                \`server.\`,
            ),
        ),

        repository: optionalWhenConfigured(config.defaultRepository).describe(
          "GitHub repository name without its owner. " +
            describeDefault(
              config.defaultRepository,
              \`Required, as no default repository is configured on this \` +
                \`server.\`,
            ),
        ),

        // TODO: replace with the parameters this tool actually takes.
        number: z
          .number()
          .int()
          .positive()
          .describe(
            \`The number identifying the issue within its repository, as \` +
              \`shown in the GitHub interface.\`,
          ),
      }),
    },
    async ({ owner, repository, number }) => {
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

      // TODO: call the GitHub API and map the response into a compact shape.
      const response = await config.octokit.rest.issues
        .get({
          owner: effectiveOwner,
          repo: effectiveRepository,
          issue_number: number,
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(\`\${TOOL_NAME} failed for "\${number}": \${reason}\`);
        });

      const payload = response.data;

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

export const ${exportName}: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
`,
);

/**
 * Adds the import and the TOOL_REGISTRATIONS entry to `toolbox/index.ts`.
 *
 * The list is a flat array of bare identifiers, so splitting it on commas
 * is enough; a comment inside the array would need this rewritten.
 */
const registerInToolbox = () => {
  const source = readFileSync(TOOLBOX_INDEX, "utf8");
  const importPath = `./tools/${toolName}.js`;

  if (source.includes(importPath)) {
    log(`  skipped ${relative(REPO_ROOT, TOOLBOX_INDEX)} (already registered)`);
    return;
  }

  const arrayPattern =
    /(export const TOOL_REGISTRATIONS: ToolRegistration\[\] = \[)([\s\S]*?)(\n?\];)/;
  const arrayMatch = source.match(arrayPattern);

  if (!arrayMatch) {
    log(
      `  warning: could not find TOOL_REGISTRATIONS in ` +
        `${relative(REPO_ROOT, TOOLBOX_INDEX)}; register ${exportName} by hand.`,
    );
    return;
  }

  // Insert the import after the last existing top-level import.
  let importEnd = 0;
  for (const match of source.matchAll(/^import\s[\s\S]*?;$/gm)) {
    importEnd = match.index + match[0].length;
  }

  let updated =
    source.slice(0, importEnd) +
    `\nimport { ${exportName} } from "${importPath}";` +
    source.slice(importEnd);

  const entries = arrayMatch[2]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
  entries.push(exportName);

  const renderedArray =
    arrayMatch[1] +
    `\n${entries.map((entry) => `  ${entry},`).join("\n")}\n` +
    "];";

  updated = updated.replace(arrayPattern, renderedArray);

  writeFileSync(TOOLBOX_INDEX, updated, "utf8");
  log(`  updated ${relative(REPO_ROOT, TOOLBOX_INDEX)}`);
};

registerInToolbox();

log(`
Next steps
  1. Fill in the description and inputSchema in ${relative(REPO_ROOT, toolFile)}
  2. Replace the API call and map the response
`);
