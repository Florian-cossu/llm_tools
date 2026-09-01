#!/usr/bin/env node

/**
 * Stamps `last_updated` with today's date on every docs note it is given.
 *
 * Takes the paths as arguments so the caller decides which files matter — the
 * pre-commit hook passes the staged ones. Validation of the rest of the
 * frontmatter belongs to check-docs.mjs, not here.
 *
 * `last_reviewed` is deliberately NOT touched. It is a human judgement about
 * whether a note still matches the code, and stamping it automatically would
 * destroy the one signal telling a reader whether to trust the note. See
 * docs/00-conventions.md.
 *
 * Paths it actually rewrote go to stdout, one per line, so a caller can pipe
 * them straight into `git add`. Everything a human reads goes to stderr.
 *
 * Usage: node scripts/timestamp-docs.mjs <path>...
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

// Local date. toISOString() is UTC and rolls the day over an hour or two early
// in Europe/Paris; "en-CA" is the ISO format in the machine's own timezone.
const TODAY = new Date().toLocaleDateString("en-CA");

const isDocsNote = (path) =>
  path.startsWith(`${DOCS}/`) &&
  path.endsWith(".md") &&
  !path.includes("/.obsidian/");

const files = process.argv
  .slice(2)
  .flatMap((arg) => arg.split(",")) // tolerate a comma-joined list too
  .map((path) => resolve(ROOT, path.trim()))
  .filter(isDocsNote);

if (files.length === 0) {
  console.error("timestamp-docs — no docs notes given, nothing to stamp");
  process.exit(0);
}

const stamped = [];
const problems = [];
const fail = (kind, file, detail) =>
  problems.push(
    `${kind.padEnd(10)} ${relative(ROOT, file)}${detail ? ` — ${detail}` : ""}`,
  );

for (const file of files) {
  const raw = readFileSync(file, "utf8");

  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!fm) {
    fail("NO-FM", file);
    continue;
  }

  const current = fm.match(/^last_updated:\s*(.*)$/m)?.[1]?.trim();
  if (current === undefined) {
    fail("MISSING", file, "last_updated");
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(current)) {
    fail("BAD-DATE", file, current);
    continue;
  }

  // Already today: leave the file, and its mtime, alone.
  if (current === TODAY) continue;

  // Scoped to the frontmatter block on purpose — 00-conventions.md documents
  // this very field inside a fenced YAML example, and that is prose.
  const updated = raw.replace(/^---\n[\s\S]*?\n---\n/, (block) =>
    block.replace(/^last_updated:.*$/m, `last_updated: ${TODAY}`),
  );

  writeFileSync(file, updated);
  stamped.push(relative(ROOT, file));
}

// stdout is the machine channel: exactly the files that changed, so the hook
// re-stages those and nothing else.
for (const name of stamped) process.stdout.write(`${name}\n`);

// The hook rewrites files mid-commit, so always say which ones.
if (stamped.length) {
  console.error(
    `timestamp-docs — stamped ${TODAY} on ${stamped.length} note${stamped.length === 1 ? "" : "s"}:`,
  );
  for (const name of stamped) console.error(`  ${name}`);
} else {
  console.error(`timestamp-docs — every note already reads ${TODAY}`);
}

if (problems.length) {
  console.error(
    `\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`,
  );
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
