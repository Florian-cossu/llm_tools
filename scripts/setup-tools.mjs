#!/usr/bin/env node

/**
 * Repo-root orchestrator for every MCP server in this repository.
 *
 * For each tool directory it runs the setup step, then the build step, then
 * prints a ready-to-paste `mcp.json` fragment covering all of them.
 *
 * Nothing here is Node-specific on purpose: a tool declares *how* it is
 * installed, built and launched in its own `tool.json`, so adding a Python or
 * Go MCP server later needs no change to this file. Plain `.mjs` with zero
 * dependencies, so the orchestrator itself never needs installing or building.
 *
 * Usage: node scripts/setup-tools.mjs [--help]
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_FILE = "tool.json";
const IGNORED_DIRS = new Set(["scripts", "node_modules", "dist"]);
const LM_STUDIO_CONFIG = join(homedir(), ".lmstudio", "mcp.json");

// Logs go to stderr so `--json-only` can be piped straight into a file.
const log = (message = "") => process.stderr.write(`${message}\n`);
const warn = (message) => log(`  ! ${message}`);

const HELP = `
Install, build and register every MCP server in this repository.

  node scripts/setup-tools.mjs [options]

Options
  --only <name>     Restrict to one tool directory (repeatable).
  --dev             Emit the "run from TypeScript sources" launch command
                    instead of the built entry point.
  --skip-install    Don't run the setup step.
  --skip-build      Don't run the build step.
  --json-only       Print the mcp.json fragment only; no setup, no build.
  --write           Merge the fragment into ~/.lmstudio/mcp.json
                    (existing file is backed up, other servers preserved).
  -h, --help        Show this help.
`;

const { values: flags } = parseArgs({
  options: {
    only: { type: "string", multiple: true, default: [] },
    dev: { type: "boolean", default: false },
    "skip-install": { type: "boolean", default: false },
    "skip-build": { type: "boolean", default: false },
    "json-only": { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (flags.help) {
  log(HELP);
  process.exit(0);
}

const skipInstall = flags["skip-install"] || flags["json-only"];
const skipBuild = flags["skip-build"] || flags["json-only"];

/** Reads a JSON file, returning null when it doesn't exist. */
function readJson(path) {
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function isExecutable(path) {
  try {
    return Boolean(statSync(path).mode & 0o111);
  } catch {
    return false;
  }
}

/**
 * A directory is a tool as soon as it declares a manifest or a package.json,
 * which keeps discovery convention-based: drop a folder in, it gets picked up.
 */
function discoverTools() {
  return readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !IGNORED_DIRS.has(entry.name),
    )
    .map((entry) => join(REPO_ROOT, entry.name))
    .filter(
      (dir) =>
        existsSync(join(dir, MANIFEST_FILE)) ||
        existsSync(join(dir, "package.json")),
    )
    .sort();
}

/**
 * Resolves one lifecycle step, most explicit source first:
 *   1. the `setup` / `build` string in tool.json
 *   2. an executable `setup.sh` / `build.sh` in the tool root
 *   3. the npm fallback, when a package.json justifies it
 */
function resolveStep(dir, manifestCommand, hookName, npmFallback) {
  if (manifestCommand === null) return null; // explicit "no step for me"
  if (typeof manifestCommand === "string") {
    return { command: manifestCommand, source: MANIFEST_FILE };
  }

  const hookPath = join(dir, `${hookName}.sh`);

  if (existsSync(hookPath)) {
    if (isExecutable(hookPath)) {
      return { command: `./${hookName}.sh`, source: `${hookName}.sh` };
    }

    warn(`${hookName}.sh is not executable, running it through sh`);

    return { command: `sh ./${hookName}.sh`, source: `${hookName}.sh` };
  }

  return npmFallback ? { command: npmFallback, source: "npm default" } : null;
}

function loadTool(dir) {
  const manifest = readJson(join(dir, MANIFEST_FILE)) ?? {};
  const pkg = readJson(join(dir, "package.json"));

  return {
    dir,
    name: basename(dir),
    serverName: manifest.mcpServerName ?? pkg?.name ?? basename(dir),
    version: manifest.version ?? pkg?.version ?? null,
    description: manifest.description ?? pkg?.description ?? "",
    setup: resolveStep(dir, manifest.setup, "setup", pkg && "npm install"),
    build: resolveStep(
      dir,
      manifest.build,
      "build",
      pkg?.scripts?.build && "npm run build",
    ),
    run: manifest.command
      ? { command: manifest.command, args: manifest.args ?? [] }
      : { command: "node", args: ["dist/index.js"] },
    dev: manifest.dev ?? {
      command: "node_modules/.bin/tsx",
      args: ["src/index.ts"],
    },
    env: manifest.env ?? null,
  };
}

function runStep(tool, step, label) {
  log(`  → ${label}: ${step.command}   (${step.source})`);

  const result = spawnSync(step.command, {
    cwd: tool.dir,
    shell: true,
    stdio: ["ignore", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed in ${tool.name} (exit code ${result.status})`,
    );
  }
}

/** Anything that looks like a path is made absolute; bare commands hit PATH. */
function absolutise(value, dir) {
  if (isAbsolute(value) || !value.includes("/")) return value;

  return join(dir, value);
}

function buildServerEntry(tool) {
  const spec = flags.dev ? tool.dev : tool.run;

  const entry = {
    command: absolutise(spec.command, tool.dir),
    args: (spec.args ?? []).map((arg) => absolutise(arg, tool.dir)),
  };

  if (tool.env) entry.env = tool.env;

  // A missing entry point is the usual symptom of a skipped or failed build.
  const entryPoint = entry.args.find((arg) => isAbsolute(arg));

  if (entryPoint && !existsSync(entryPoint)) {
    warn(`${entryPoint.replace(`${REPO_ROOT}/`, "")} does not exist yet`);
  }

  return entry;
}

function checkEnvFile(tool) {
  const hasTemplate = existsSync(join(tool.dir, ".env.example"));
  const hasEnv = existsSync(join(tool.dir, ".env"));

  if (hasTemplate && !hasEnv) {
    warn(`no .env yet — run: cp ${tool.name}/.env.example ${tool.name}/.env`);
  }
}

/** Merges our servers into LM Studio's config, preserving everything else. */
function writeLmStudioConfig(servers) {
  const existing = readJson(LM_STUDIO_CONFIG) ?? {};

  if (existsSync(LM_STUDIO_CONFIG)) {
    copyFileSync(LM_STUDIO_CONFIG, `${LM_STUDIO_CONFIG}.backup`);
    log(`Backed up existing config to ${LM_STUDIO_CONFIG}.backup`);
  } else {
    mkdirSync(dirname(LM_STUDIO_CONFIG), { recursive: true });
  }

  const overwritten = Object.keys(servers).filter(
    (name) => existing.mcpServers?.[name],
  );

  existing.mcpServers = { ...existing.mcpServers, ...servers };

  writeFileSync(LM_STUDIO_CONFIG, `${JSON.stringify(existing, null, 2)}\n`);

  log(`Wrote ${LM_STUDIO_CONFIG}`);

  if (overwritten.length > 0) {
    log(`Replaced existing entries: ${overwritten.join(", ")}`);
  }

  log("Restart the servers from LM Studio to pick up the changes.");
}

function main() {
  const requested = flags.only ?? [];

  const tools = discoverTools()
    .map(loadTool)
    .filter((tool) => requested.length === 0 || requested.includes(tool.name));

  if (tools.length === 0) {
    log(
      requested.length > 0
        ? `No tool directory matched: ${requested.join(", ")}`
        : "No tool directories found.",
    );
    process.exit(1);
  }

  log(
    `Found ${tools.length} tool(s): ${tools.map((tool) => tool.name).join(", ")}`,
  );

  const servers = {};

  for (const tool of tools) {
    log("");
    log(
      `${tool.name}${tool.version ? ` v${tool.version}` : ""}` +
        `${tool.description ? ` — ${tool.description}` : ""}`,
    );

    if (!skipInstall && tool.setup) runStep(tool, tool.setup, "setup");
    else if (!skipInstall) warn("no setup step declared, skipping");

    if (!skipBuild && tool.build) runStep(tool, tool.build, "build");
    else if (!skipBuild) warn("no build step declared, skipping");

    checkEnvFile(tool);

    servers[tool.serverName] = buildServerEntry(tool);
  }

  const fragment = { mcpServers: servers };

  log("");
  log(
    flags.dev
      ? "mcp.json fragment (dev mode — runs the TypeScript sources):"
      : "mcp.json fragment:",
  );
  log("");

  process.stdout.write(`${JSON.stringify(fragment, null, 2)}\n`);

  if (flags.write) {
    log("");
    writeLmStudioConfig(servers);
  } else if (!flags["json-only"]) {
    log("");
    log(`Paste the above into ${LM_STUDIO_CONFIG}`);
    log("or re-run with --write to merge it in automatically.");
  }
}

try {
  main();
} catch (error) {
  log("");
  log(`Error: ${error.message}`);
  process.exit(1);
}
