#!/usr/bin/env node

/**
 * Re-homes dependencies the shadcn CLI writes into control_panel/package.json
 * back to the root package.json, per ADR-0005 (declared once, at the root).
 *
 * `shadcn init|add|apply` isn't workspace-aware: pointed at --cwd control_panel
 * it reads and writes control_panel/package.json directly, and installs into a
 * nested control_panel/node_modules/ that shadows the root. Run this right
 * after any shadcn command touches the panel.
 *
 * A package already declared at root (in either dependencies or
 * devDependencies) is updated in place if the CLI asked for a different
 * range, and never duplicated into the other field — that's what keeps a
 * manual reclassification (e.g. tw-animate-css living in devDependencies
 * because it's build-time-only, same bucket as tailwindcss) from being
 * silently undone by the next `shadcn add`. A genuinely new package is added
 * under whichever field the CLI put it in.
 *
 * Contract: docs/03-decisions/ADR-0005-root-dependencies.md
 * Usage: node scripts/rehome-panel-deps.mjs [--quiet]
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");
const log = (...args) => { if (!quiet) console.log(...args); };

const PANEL_DIR = join(ROOT, "control_panel");
const PANEL_PKG_PATH = join(PANEL_DIR, "package.json");
const ROOT_PKG_PATH = join(ROOT, "package.json");
const FIELDS = ["dependencies", "devDependencies"];

if (!existsSync(PANEL_PKG_PATH)) {
  console.error(`No package.json at ${PANEL_PKG_PATH}`);
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
const findField = (pkg, name) => FIELDS.find((f) => pkg[f]?.[name] !== undefined) ?? null;

const panelPkg = readJson(PANEL_PKG_PATH);
const rootPkg = readJson(ROOT_PKG_PATH);

const moved = [];
const bumped = [];
let panelChanged = false;

for (const field of FIELDS) {
  const entries = panelPkg[field];
  if (!entries) continue;

  for (const [name, range] of Object.entries(entries)) {
    if (String(range).startsWith("workspace:")) continue; // a workspace sibling, not a third party

    const existingField = findField(rootPkg, name);
    if (existingField) {
      if (rootPkg[existingField][name] !== range) {
        bumped.push(`${name}: ${rootPkg[existingField][name]} -> ${range} (${existingField})`);
        rootPkg[existingField][name] = range;
      }
    } else {
      rootPkg[field] ??= {};
      rootPkg[field][name] = range;
      moved.push(`${name}@${range} -> ${field}`);
    }
  }

  delete panelPkg[field];
  panelChanged = true;
}

for (const field of FIELDS) {
  if (rootPkg[field]) rootPkg[field] = sorted(rootPkg[field]);
}

let changed = false;

if (panelChanged) {
  writeJson(PANEL_PKG_PATH, panelPkg);
  changed = true;
}
if (moved.length || bumped.length) {
  writeJson(ROOT_PKG_PATH, rootPkg);
  changed = true;
  if (moved.length) log(`Moved to root:\n  ${moved.join("\n  ")}`);
  if (bumped.length) log(`Version updated at root:\n  ${bumped.join("\n  ")}`);
} else if (panelChanged) {
  log("control_panel/package.json declared only packages already at root, identically — stripped the redundant block.");
} else {
  log("No dependencies in control_panel/package.json — nothing to move.");
}

const nested = join(PANEL_DIR, "node_modules");
if (existsSync(nested)) {
  rmSync(nested, { recursive: true, force: true });
  log("Removed shadowing control_panel/node_modules");
  changed = true;
}

if (!changed) {
  log("Already up to date.");
  process.exit(0);
}

log("\nRunning bun install...");
execSync("bun install", { cwd: ROOT, stdio: quiet ? "ignore" : "inherit" });

log("\nNext: bun run check:deps — if it reports a DUPLICATE from a version bump, follow up with bun run deps:reset.");
