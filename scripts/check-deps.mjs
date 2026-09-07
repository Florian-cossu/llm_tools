#!/usr/bin/env node

/**
 * Validates the dependency layout: one declaration site, one copy installed.
 *
 * ADR-0005 says third-party packages are declared once in the root
 * package.json and nowhere else. Nothing enforces that at install time — Bun is
 * happy to resolve a second copy — so a stray declaration or a stale nested
 * node_modules/ can put two versions of the same library in one process. Two
 * copies of zod is the case that bites: a schema built in @llm-tools/shared is
 * composed into a z.object() inside a tool, and instanceof across the boundary
 * is false.
 *
 * Deliberately checks the tree on disk, not just the manifests, because the
 * manifests were right the last time this went wrong.
 *
 * Contract: docs/03-decisions/ADR-0005-root-dependencies.md
 * Usage: node scripts/check-deps.mjs [--quiet]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");

const problems = [];
const fail = (kind, where, detail) =>
  problems.push(`${kind.padEnd(12)} ${where}${detail ? ` — ${detail}` : ""}`);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const rootPkg = readJson(join(ROOT, "package.json"));

/**
 * Resolves the root package.json's own `workspaces` field instead of assuming
 * everything lives under tools/ — so a workspace added anywhere (e.g. a
 * literal "control_panel" entry) gets the same checks below, with nothing to
 * remember to update here. Only the two glob shapes this repo actually uses
 * are supported: a trailing "/*" (one directory level under the prefix) and a
 * literal path with no wildcard.
 */
function resolveWorkspaceDirs(root, patterns) {
  const dirs = new Set();
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const base = join(root, pattern.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.add(join(base, entry.name));
      }
    } else {
      const dir = join(root, pattern);
      if (existsSync(dir)) dirs.add(dir);
    }
  }
  return [...dirs];
}

/** Workspace manifests: every package.json the root's `workspaces` field resolves to. */
const workspaceManifests = resolveWorkspaceDirs(ROOT, rootPkg.workspaces ?? [])
  .map((dir) => join(dir, "package.json"))
  .filter(existsSync);

// ---- 1. no pins, anywhere ------------------------------------------------
// A forced resolution hides a version disagreement instead of removing it.
for (const path of [join(ROOT, "package.json"), ...workspaceManifests]) {
  const pkg = readJson(path);
  for (const key of ["overrides", "resolutions"]) {
    if (pkg[key] && Object.keys(pkg[key]).length) {
      fail("PIN", relative(ROOT, path), `"${key}" — ADR-0005 forbids forced resolutions`);
    }
  }
}

// ---- 2. workspace manifests declare workspace siblings only --------------
for (const path of workspaceManifests) {
  const pkg = readJson(path);
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (!String(range).startsWith("workspace:")) {
        fail("DECLARED", relative(ROOT, path),
          `${field}.${name}="${range}" — declare it in the root package.json instead`);
      }
    }
  }
}

// ---- 3. nothing but workspace links under a server's node_modules --------
// A leftover nested tree shadows the root for everything beneath it.
for (const path of workspaceManifests) {
  const nested = join(dirname(path), "node_modules");
  if (!existsSync(nested)) continue;
  for (const entry of readdirSync(nested)) {
    if (entry.startsWith(".") || entry === "@llm-tools") continue;
    fail("SHADOWED", relative(ROOT, nested),
      `${entry} — shadows the root copy; run "bun run deps:reset"`);
  }
}

// ---- 4. one installed copy of each root-declared package -----------------
// Bun's store is node_modules/.bun/<name>@<version>. Scoped names become
// <scope>+<name>@<version>. Transitive duplicates are none of our business;
// a duplicate of something first-party code imports is.
const store = join(ROOT, "node_modules", ".bun");
const declared = [
  ...Object.keys(rootPkg.dependencies ?? {}),
  ...Object.keys(rootPkg.devDependencies ?? {}),
];
const versions = new Map(declared.map((name) => [name, []]));

if (existsSync(store)) {
  for (const entry of readdirSync(store)) {
    const at = entry.lastIndexOf("@");
    if (at <= 0) continue;
    const name = entry.slice(0, at).replace("+", "/");
    if (versions.has(name)) versions.get(name).push(entry.slice(at + 1));
  }
} else {
  fail("NO-STORE", "node_modules/.bun", "run bun install first");
}

for (const [name, found] of versions) {
  if (found.length > 1) {
    fail("DUPLICATE", name,
      `${found.sort().join(", ")} — one copy only; run "bun run deps:reset"`);
  }
}

// ---- 5. the lockfile agrees with each workspace version ------------------
// --frozen-lockfile does not catch this: Bun tolerates a workspace version
// that has moved on from the lock, so the handshake can report a version the
// lockfile has never heard of.
const lockPath = join(ROOT, "bun.lock");
if (existsSync(lockPath)) {
  const lock = readFileSync(lockPath, "utf8");
  for (const path of workspaceManifests) {
    const pkg = readJson(path);
    if (!pkg.version) continue;
    const dir = relative(ROOT, dirname(path));
    const entry = lock.match(
      new RegExp(`"${dir}":\\s*\\{[^}]*?"version":\\s*"([^"]+)"`, "s"),
    );
    if (entry && entry[1] !== pkg.version) {
      fail("LOCK-STALE", `${dir}/package.json`,
        `version ${pkg.version}, but bun.lock says ${entry[1]} — regenerate the lockfile`);
    }
  }
} else {
  fail("NO-LOCK", "bun.lock", "missing — commit it");
}

// ---- report --------------------------------------------------------------
if (!quiet) {
  const counts = [...versions].map(([n, v]) => `${n}=${v[0] ?? "?"}`).sort();
  console.log(`deps/  ${declared.length} root packages (${Object.keys(rootPkg.dependencies ?? {}).length} runtime), ${workspaceManifests.length} workspaces`);
  console.log(`single ${counts.join("  ")}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

if (!quiet) console.log("\nOK — one declaration site, one copy of each.");
