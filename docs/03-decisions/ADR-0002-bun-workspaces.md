---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-08-30
summary: Bun workspaces with TypeScript executed directly - no build step, no bundling, no publishing of the shared package.
read_when:
  - adding a dependency, a build step or a new workspace
  - wondering why there is no dist/ anywhere
code_refs:
  - package.json
  - tsconfig.json
  - tools/shared/package.json
tags:
  - adr
  - tooling
  - bun
---

# ADR-0002: Bun workspaces, no build step

## Context

Several servers need to share helpers ([`@llm-tools/shared`](../02-architecture/components/shared-package.md)).
The usual options are copy-paste, publishing the shared code to a registry, or a
monorepo with workspaces.

Separately: TypeScript normally needs compiling before it runs. Bun executes it
directly.

The dominant workflow is *edit a tool, restart the server from the client, try
the prompt again* — a loop run many times a day.

## Decision

A **Bun workspace monorepo** with **no build step**.

```json
{ "workspaces": ["tools/*", "tools/shared/*"] }
```

- Servers depend on shared via `"@llm-tools/shared": "workspace:*"`.
- The root `tsconfig.json` maps the import straight to source:
  `"@llm-tools/shared": ["./tools/shared/src/index.ts"]`.
- Servers launch as `bun run src/index.ts`. `tool.json` sets `"build": null`.
- `tools/shared` is `private: true` — never published.

## Consequences

**Gained**

- Edit → restart → test. Nothing between the source and the running server, so
  no stale-build class of bug at all.
- One `bun install` at the root wires every workspace.
- Shared code is versionless and always in sync; a change to a helper is live
  for every server at once.
- Types flow across packages without a build, because the path maps to source.

**Cost**

- **Bun is required**, and 1.3+. This is not portable to a plain Node runtime
  without adding the build step the decision exists to avoid.
- **No compile-time gate.** Nothing type-checks on the way to running. With no
  test suite either ([testing](../06-workflows/testing.md)), a type error
  surfaces at call time — the strongest current argument for building one.
- A breaking change in shared breaks every server silently.
- `setup-tools.mjs` still carries build-step machinery for servers that might
  need it — dead weight today, and the price of staying runtime-agnostic.

**Kept open**

`tool.json`'s `build` field and the github `package.json`'s `build` script
(`bun build … --outfile dist/index.js`) exist but are unused, so a server that
does need bundling can opt in without changing the orchestration.

## Alternatives

**Publishing `@llm-tools/shared` to npm.** Rejected: a publish step in the inner
loop, and version skew between servers, for a package with exactly one consumer
repo.

**Copying helpers into each server.** Rejected: the
[three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule)
is subtle enough that it must have one implementation.

**`tsc` build then run JavaScript.** Rejected: adds a step to every iteration
and a stale-`dist` failure mode. The type-checking it would provide is real, and
is better recovered by adding `tsc --noEmit` to a validation script than by
compiling to run.
