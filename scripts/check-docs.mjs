#!/usr/bin/env node

/**
 * Validates the docs/ vault: frontmatter schema, internal links, code references.
 *
 * The vault is meant to be navigated by an agent deciding what *not* to read,
 * which only works if the metadata is trustworthy. This checks that it is.
 *
 * Contract: docs/00-conventions.md
 * Usage: node scripts/check-docs.mjs [--quiet]
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const quiet = process.argv.includes("--quiet");

// Controlled vocabularies — see docs/00-conventions.md
const TYPES = new Set(["index", "context", "architecture", "component", "decision",
  "contract", "harness", "workflow", "plan", "archive", "generated"]);
const STATUS = new Set(["active", "draft", "planned", "superseded", "deprecated",
  "accepted", "proposed"]); // the last two are the ADR vocabulary
const SCOPES = new Set(["repo", "github", "shared", "scripts", "mcp"]);
const REQUIRED = ["type", "status", "scope", "last_reviewed", "last_updated", "summary", "tags"];

// A note whose body moved this long ago without anyone re-reading it against
// the code is the next thing to go stale. Reported, not fatal.
const DRIFT_DAYS = 14;

const files = execSync(`find ${DOCS} -name "*.md" -not -path "*/.obsidian/*"`)
  .toString().trim().split("\n").filter(Boolean).sort();

const problems = [];
const fail = (kind, file, detail) =>
  problems.push(`${kind.padEnd(10)} ${relative(ROOT, file)}${detail ? ` — ${detail}` : ""}`);

/** Links inside fenced blocks or code spans are illustrative, not navigation. */
const stripCode = (s) =>
  s.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

/** GitHub's heading-anchor rule. Note it does *not* collapse runs of spaces. */
const slug = (heading) =>
  heading.replace(/^#{1,6}\s+/, "").toLowerCase()
    .replace(/[^\w\s-]/g, "").trim().replace(/ /g, "-");

const anchors = new Map(
  files.map((f) => [f, new Set(readFileSync(f, "utf8").split("\n")
    .filter((l) => /^#{1,6}\s/.test(l)).map(slug))]),
);

let links = 0;
const drifted = [];
const stats = { type: {}, status: {} };

for (const file of files) {
  const raw = readFileSync(file, "utf8");

  // ---- frontmatter -------------------------------------------------------
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!fm) {
    fail("NO-FM", file);
  } else {
    const field = (k) => fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim();

    for (const key of REQUIRED) {
      if (!new RegExp(`^${key}:`, "m").test(fm)) fail("MISSING", file, key);
    }
    const [type, status, scope] = ["type", "status", "scope"].map(field);
    if (type && !TYPES.has(type)) fail("BAD-TYPE", file, type);
    if (status && !STATUS.has(status)) fail("BAD-STATUS", file, status);
    if (scope && !SCOPES.has(scope)) fail("BAD-SCOPE", file, scope);

    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const reviewed = field("last_reviewed");
    const updated = field("last_updated");
    if (reviewed && !ISO_DATE.test(reviewed)) fail("BAD-DATE", file, reviewed);
    if (updated && !ISO_DATE.test(updated)) fail("BAD-DATE", file, updated);

    // last_updated is stamped by the pre-commit hook; last_reviewed is a human
    // saying the note still matches the code. When the first runs ahead of the
    // second, the note changed without anyone re-checking it.
    if (ISO_DATE.test(reviewed ?? "") && ISO_DATE.test(updated ?? "")) {
      const days = (Date.parse(updated) - Date.parse(reviewed)) / 86400000;
      if (days > DRIFT_DAYS) {
        drifted.push(`${relative(ROOT, file)} — reviewed ${reviewed}, updated ${updated} (${Math.round(days)}d)`);
      }
    }

    stats.type[type] = (stats.type[type] ?? 0) + 1;
    stats.status[status] = (stats.status[status] ?? 0) + 1;

    // code_refs are the doc↔code bridge; a stale one is worse than none
    const refs = fm.match(/^code_refs:\n((?:[ \t]+-[ \t].*\n)+)/m)?.[1];
    if (refs) {
      for (const line of refs.trim().split("\n")) {
        const path = line.replace(/^\s*-\s*/, "").trim();
        if (!existsSync(join(ROOT, path))) fail("BAD-REF", file, path);
      }
    }
  }

  // ---- links -------------------------------------------------------------
  const body = stripCode(raw);

  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    fail("WIKILINK", file, `[[${m[1]}]] — use a relative Markdown link`);
  }

  for (const [, , href] of body.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    links++;
    const [path, anchor] = href.split("#");
    const target = resolve(dirname(file), path);

    if (!existsSync(target)) { fail("BROKEN", file, href); continue; }
    if (statSync(target).isDirectory()) { fail("DIR-LINK", file, `${href} — link its index note`); continue; }
    if (anchor && anchors.has(target) && !anchors.get(target).has(anchor)) {
      fail("BAD-ANCHOR", file, href);
    }
  }
}

const summarise = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k}=${v}`).join("  ");

if (!quiet) {
  console.log(`docs/  ${files.length} notes, ${links} internal links`);
  console.log(`type    ${summarise(stats.type)}`);
  console.log(`status  ${summarise(stats.status)}`);
}

if (drifted.length && !quiet) {
  console.warn(`\n${drifted.length} note${drifted.length === 1 ? "" : "s"} changed >${DRIFT_DAYS}d ago without re-review:`);
  for (const d of drifted) console.warn(`  ${d}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

if (!quiet) console.log("\nOK — frontmatter, links and code references all valid.");
