#!/usr/bin/env node

/**
 * Scaffolds a new MCP tool in the tools/ directory.
 *
 * Usage: node scripts/create-tool.mjs <tool-name> [--description "..."]
 *
 * Example: node scripts/create-tool.mjs linear --description "Linear issue tracker"
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS_DIR = resolve(REPO_ROOT, "tools");

const log = (msg = "") => process.stderr.write(`${msg}\n`);
const write = (path, content) => {
  writeFileSync(path, content, "utf8");
  log(`  created ${path.replace(REPO_ROOT + "/", "")}`);
};

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    description: { type: "string", default: "" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (flags.help || positionals.length === 0) {
  log(`
Create a new MCP tool in the tools/ directory.

  node scripts/create-tool.mjs <tool-name> [options]

Options
  --description "..."   Short description of the tool
  -h, --help            Show this help

Example
  node scripts/create-tool.mjs linear --description "Linear issue tracker"
`);
  process.exit(0);
}

const toolName = positionals[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
const toolDir = resolve(TOOLS_DIR, toolName);
const description = flags.description || `MCP server for ${toolName}`;
const serverName = toolName;
const packageName = `@llm-tools/${toolName}`;
/** `my-server` -> `MY_SERVER`, for the server's own `.env` variables. */
const envPrefix = toolName.replace(/[^a-z0-9]+/gi, "_").toUpperCase();

if (existsSync(toolDir)) {
  log(`Error: tools/${toolName} already exists.`);
  process.exit(1);
}

log(`\nScaffolding tool: ${toolName}`);
log(`  Directory: ${toolDir}`);
log("");

// Create directory structure.
for (const dir of [
  toolDir,
  `${toolDir}/src`,
  `${toolDir}/src/toolbox`,
  `${toolDir}/src/toolbox/tools`,
]) {
  mkdirSync(dir, { recursive: true });
}

// package.json
write(
  `${toolDir}/package.json`,
  JSON.stringify(
    {
      name: packageName,
      version: "1.0.0",
      description,
      type: "module",
      scripts: {
        start: "bun run src/index.ts",
      },
      // Workspace siblings only. Third-party dependencies are declared once
      // in the root package.json — ADR-0005. Adding them here reintroduces the
      // duplicate-resolution bug that decision exists to prevent.
      dependencies: {
        "@llm-tools/shared": "workspace:*",
      },
    },
    null,
    2,
  ) + "\n",
);

// tool.json
write(
  `${toolDir}/tool.json`,
  JSON.stringify(
    {
      mcpServerName: serverName,
      setup: "bun install",
      build: null,
      command: "bun",
      args: ["run", "src/index.ts"],
      dev: {
        command: "bun",
        args: ["run", "src/index.ts"],
      },
    },
    null,
    2,
  ) + "\n",
);

// tsconfig.json
write(
  `${toolDir}/tsconfig.json`,
  JSON.stringify(
    {
      extends: "../../tsconfig.json",
      include: ["src/**/*.ts"],
    },
    null,
    2,
  ) + "\n",
);

// .env.example
write(
  `${toolDir}/.env.example`,
  `# Copy this file to .env and fill in the values.
# cp .env.example .env

# Add your environment variables here.
# MY_API_TOKEN=your_token_here

# Write tools are off unless this is set (1, true, yes or on). Leave it
# empty and only read-only tools are registered - see ADR-0007.
${envPrefix}_ALLOW_WRITES=
`,
);

// src/metadata.ts
write(
  `${toolDir}/src/metadata.ts`,
  `import packageJson from "../package.json" with { type: "json" };

export const APP_NAME = packageJson.name;
export const APP_VERSION = packageJson.version;
`,
);

// src/server_instructions.ts
write(
  `${toolDir}/src/server_instructions.ts`,
  `import type { ServerConfig } from "./index.ts";

export function buildServerInstructions(config: ServerConfig): string {
  return (
    \`You are a \${config.serverName} v\${config.serverVersion} assistant.\\n\` +
    \`Use the available tools to help the user.\\n\` +
    \`Never invent results: always call a tool to get real data.\\n\`
  );
}
`,
);

// src/toolbox/tools/example_tool.ts
write(
  `${toolDir}/src/toolbox/tools/example_tool.ts`,
  `import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { ToolEffect } from "@llm-tools/shared";
import type { ServerConfig } from "../../index.ts";
import type { ToolRegistration } from "../index.ts";

export const TOOL_NAME = "example_tool";

/**
 * What calling this does upstream: "read", "write" or "destructive".
 * Keep it honest - the server gates registration on it, and a "read"
 * tool that mutates is a defect. See ADR-0007.
 */
export const TOOL_EFFECT: ToolEffect = "read";

function register(
  server: McpServer,
  config: ServerConfig,
): void {
  server.registerTool(
    TOOL_NAME,
    {
      description: "An example tool. Replace this with your own implementation.",
      inputSchema: z.object({
        message: z.string().describe("A message to echo back"),
      }),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ echo: message }),
          },
        ],
      };
    },
  );
}

export const exampleTool: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
`,
);

// src/toolbox/index.ts
write(
  `${toolDir}/src/toolbox/index.ts`,
  `import type { McpServer } from "@modelcontextprotocol/server";
import type { ToolEffect } from "@llm-tools/shared";
import type { ServerConfig } from "../index.ts";
import { exampleTool } from "./tools/example_tool.ts";

export type ToolInstance = (server: McpServer, config: ServerConfig) => void;

/**
 * One tool, as the server sees it before deciding to register it. The
 * name and effect sit outside the registrar so the gate in index.ts can
 * read them without running anything (ADR-0007).
 */
export type ToolRegistration = {
  name: string;
  effect: ToolEffect;
  register: ToolInstance;
};

/** Every tool this server can expose - listed is not the same as registered. */
export const TOOL_REGISTRATIONS: ToolRegistration[] = [exampleTool];
`,
);

// src/index.ts
write(
  `${toolDir}/src/index.ts`,
  `import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { APP_NAME, APP_VERSION } from "./metadata.ts";
import { booleanFromEnv, registrationRefusal } from "@llm-tools/shared";
import { buildServerInstructions } from "./server_instructions.ts";
import { TOOL_REGISTRATIONS } from "./toolbox/index.ts";

export type ServerConfig = {
  serverName: string;
  serverVersion: string;
  /** Whether mutating tools may be registered at all. Off by default. */
  allowWrites: boolean;
};

const config: ServerConfig = {
  serverName: APP_NAME,
  serverVersion: APP_VERSION,
  allowWrites: booleanFromEnv(process.env.${envPrefix}_ALLOW_WRITES),
};

// The gate is here, not in the handlers: a tool whose effect the config
// does not allow is never registered, so the model never sees a
// capability it must not use (ADR-0007).
const allowed = TOOL_REGISTRATIONS.filter((registration) => {
  const refusal = registrationRefusal(registration.effect, config.allowWrites);

  if (refusal !== null) {
    // stdout is the JSON-RPC channel - diagnostics go to stderr.
    console.error(\`Not registering \${registration.name}: it \${refusal}.\`);
  }

  return refusal === null;
});

const server = new McpServer(
  {
    name: APP_NAME,
    version: APP_VERSION,
  },
  {
    instructions: buildServerInstructions(config),
  },
);

for (const registration of allowed) {
  registration.register(server, config);
}

const transport = new StdioServerTransport();
await server.connect(transport);
`,
);

log("Done. Next steps:\n");
log(`  1. cd tools/${toolName}`);
log(`  2. Edit .env.example, then: cp .env.example .env`);
log(`  3. Implement your tools in src/toolbox/tools/`);
log(`  4. Register them in src/toolbox/index.ts, declaring each TOOL_EFFECT`);
log(`  5. From the repo root: node scripts/setup-tools.mjs --write`);
log("");