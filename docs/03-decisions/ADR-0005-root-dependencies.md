---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-08-30
summary: Third-party dependencies are declared once in the root package.json; a server's own package.json declares only its workspace siblings.
read_when:
  - adding a dependency to a server
  - wondering why tools/<name>/package.json has almost nothing in it
  - a server resolves an unexpected version of a package
code_refs:
  - package.json
  - tools/github/package.json
  - tools/shared/package.json
tags:
  - adr
  - tooling
  - bun
  - dependencies
---

# ADR-0005: Dependencies live in the root package.json

## Context

[ADR-0002](ADR-0002-bun-workspaces.md) established Bun workspaces, but said
nothing about *where* a dependency is declared. The initial layout put them in
each server: `tools/github/package.json` carried `@modelcontextprotocol/server`,
`dotenv`, `octokit`, `zod` and a `typescript` devDependency.

Every server here is an MCP server reading one HTTP API. The next one will need
the same MCP SDK, the same `zod`, the same `dotenv` — only the API client
differs. Declaring those per server means the same four entries repeated, and
four places to bump when one of them moves.

Worse, nothing keeps the ranges aligned. `tools/github` asked for `zod@^4.4.3`
while nothing else pinned it, so two servers could quietly run different
versions of the library that builds every input schema.

## Decision

**Third-party dependencies are declared once, in the root `package.json`.**

A server's own `package.json` keeps only its identity (`name`, `version`,
`description`, `scripts`) and its **workspace** dependencies:

```json
{
  "name": "@llm-tools/github",
  "version": "1.5.0",
  "dependencies": { "@llm-tools/shared": "workspace:*" }
}
```

`bun add <pkg>` is run at the repository root. Bun installs into the root
`node_modules/`, and Node resolution walks up from `tools/<name>/src/` to find
it — no per-server install, no duplication.

The `version` field stays per server: it is the MCP server version, read by
`metadata.ts` and reported in the handshake
([release](../06-workflows/release.md)).

## Consequences

**Gained**

- One place to add, bump or audit a dependency.
- One resolved version of `zod` intended across every server, so a schema built
  by `@llm-tools/shared` and one built in a tool are the same library.
- A new server needs no dependency block at all — it inherits the set.
- Smaller diffs: adding a server touches the root lockfile, not five manifests.

**Cost**

- **Servers are no longer self-describing.** `tools/github/package.json` does
  not say it needs Octokit. Lifting a server out of this repo means rediscovering
  its dependencies by reading its imports.
- **Phantom dependencies.** Every server can import anything any other server
  needs, and nothing fails. A server accidentally depending on a package it has
  no business using will not be caught until that package is removed.
- `tool.json`'s `"setup": "bun install"` is now doing a **workspace-wide**
  install from a server directory. Correct, but no longer local in effect
  ([tool package](../02-architecture/components/tool-package.md#tooljson)).
- Dropping a dependency requires checking every server, not one.
- **A broken dependency breaks every server at once.** Accepted deliberately:
  one loud repo-wide failure is easier to notice, and cheaper to diagnose, than
  one server quietly running a version nobody chose.
- A duplicate in the tree is now a defect to trace rather than something to pin
  around — see below. That costs more the first time and less every time after.

### No `overrides`, no `resolutions`, ever

One install at the root is the whole rule. **Nothing in this repository pins,
forces or rewrites a resolution**, and that is deliberate: a pin makes a
disagreement between two packages *look* resolved while leaving it in the tree.
When a dependency does break, it must break **repo-wide and visibly**, because
that is the signal that something needs looking at. An override converts that
signal into silence.

So when a duplicate appears, it is a symptom to trace, never something to
overrule. When this decision was first applied, `zod` resolved three ways at
once:

| Importer | Resolved `zod` to |
| --- | --- |
| `tools/github/src/**` | `4.4.3`, from a leftover `tools/github/node_modules/` |
| `@llm-tools/shared` | `4.5.4`, the root declaration |
| `@modelcontextprotocol/server` | `4.4.3`, its own nested copy |

Three causes, none of them needing a pin:

1. **A stale nested `node_modules/`.** Emptying `tools/github/package.json` does
   not prune what a previous install left in `tools/github/node_modules/`, and
   that directory shadows the root for everything beneath it.
2. **A second range in a workspace manifest.** `tools/shared` declared
   `zod@^4.4.3` against the root's `^4.5.4`. That disagreement is what Bun was
   resolving, and it is exactly the duplication this ADR removes — the manifest
   now declares no third-party dependencies at all.
3. **A stale transitive resolution in the lockfile.** `@modelcontextprotocol/server`
   asks for `zod@^4.2.0`. `4.5.4` satisfies that, so there was never a genuine
   conflict — the lockfile was simply carrying a nested `4.4.3` from an earlier
   install and kept honouring it.

The fix was to remove the causes, then let Bun resolve from clean:

```bash
rm -rf node_modules tools/*/node_modules bun.lock
bun install
```

A regenerated lockfile resolves a single `zod@4.5.4` for the tools, for
`@llm-tools/shared` and for the MCP SDK, with nothing forcing it. The nested
`node_modules/` under a server is then just the `@llm-tools` workspace symlink.

> [!important] Deleting `bun.lock` re-resolves **every** transitive range
> That is the point — it is also why it is a deliberate act, not part of the
> normal loop. Do it when the tree is wrong, then check the server still starts.

### Checking it held

Nothing about this decision is enforced by the package manager, so it is
enforced by a script:

```bash
bun run check:deps      # also runs inside bun run test
```

[`check-deps.mjs`](../../scripts/check-deps.mjs) refuses a pin in any manifest,
a third-party declaration in a workspace manifest, a nested `node_modules/` that
shadows the root, a root-declared package installed twice, and a workspace
version that has drifted from `bun.lock`. That last one exists because no form
of `bun install` catches it — neither `--frozen-lockfile`, which `bun run test`
no longer uses, nor the plain install it now runs. A workspace `version` bump
leaves the lockfile behind silently; `bun run deps:reset` is the fix. Verified,
not assumed.

The check that matters most is the duplicate: more than one `zod` means a schema
built in `@llm-tools/shared` and a schema built in a tool are different
libraries, and `instanceof` across that boundary is false.

## Alternatives

**Dependencies per server, as before.** Rejected: four repeated entries per
server and no mechanism keeping versions aligned — the problem that prompted
this.

**Root `peerDependencies` in each server.** Declares what a server uses without
installing it twice, which would fix the self-describing cost. Rejected for now
as ceremony for a repo with one server; worth revisiting at three.

**A `catalog:` of versions.** Bun supports catalogs, which would keep servers
self-describing *and* versions aligned. The better answer if the phantom
dependency cost ever bites — recorded here rather than adopted, since it trades
the simplicity this decision was made for.

**`overrides` / `resolutions` to force a single version.** Rejected on
principle, not on mechanics: it works, and that is the problem. A forced
resolution hides the disagreement instead of removing it, and leaves a pin to
maintain on every bump. If two packages genuinely cannot agree on a version,
that is information — deal with the cause.
