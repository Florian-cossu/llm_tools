---
type: workflow
status: draft
scope: repo
last_reviewed: 2026-08-30
summary: The manual validation checklist that is the only real gate today, plus what an automated suite would need.
read_when:
  - validating a change before committing
  - about to run `bun test` and expecting it to mean something
code_refs:
  - package.json
  - CLAUDE.md
tags:
  - workflow
  - testing
  - validation
---

# Testing

> [!warning] `bun test` and `bun run test` are not the same command
> **`bun test`** — the test runner — matches **zero files** and exits
> **successfully**, having verified nothing. There are no test files in this
> repository ([harness overview](../05-harness/overview.md)).
>
> **`bun run test`** runs the root `test` *script*, which is something else
> entirely:
>
> ```bash
> rm -rf node_modules && node scripts/check-docs.mjs && bun install
> ```
>
> That validates the docs vault and proves the workspace installs from clean —
> worth running, and the check that catches a dependency missing from the root
> `package.json` since [ADR-0005](../03-decisions/ADR-0005-root-dependencies.md).
> It runs **no tests**. Do not read a green `bun run test` as "the code works".
>
> There is also **no type-check step**: with no build
> ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md)), nothing checks types
> before runtime. `npx tsc --noEmit -p tools/<name>/tsconfig.json` works by hand.

The checklist below is the actual gate.

---

## Manual validation

### 0. Workspace

```bash
bun run test        # docs + frozen install + dependency layout. Runs no tests
```

Four steps, each failing loudly:

- [ ] `check-docs.mjs` passes
- [ ] The install completes from clean — a dependency used but missing from the
      root `package.json` shows up here
- [ ] `--frozen-lockfile` holds: a manifest that declares something `bun.lock`
      does not have fails with *"lockfile had changes, but lockfile is frozen"*.
      Commit the lockfile rather than working around it
- [ ] `check-deps.mjs` passes — one declaration site, one copy of each
      ([ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever))

`bun run test` deliberately does **not** delete `bun.lock`. Regenerating it every
run would make each run resolve a different tree and turn an upstream publish
into an unattributable break. When the tree really is wrong, `bun run deps:reset`
is the deliberate act — and `check-deps.mjs` is what tells you it is needed.

### 1. Server health

```bash
bun run tools/<name>/src/index.ts        # must hang silently, printing nothing
```

- [ ] Starts with **no `.env` present** — a missing credential is a per-call
      error, not a crash (S9, [server contract](../04-contracts/mcp-server-contract.md))
- [ ] Starts with a complete `.env`
- [ ] Nothing on `stdout`

### 2. Surface

```bash
npx @modelcontextprotocol/inspector bun run tools/<name>/src/index.ts
```

- [ ] Handshake reports the expected name and version
- [ ] Every tool appears, under its intended **public** name
- [ ] Instructions appear, and mention configured defaults **only when set**
- [ ] With defaults configured: `owner`/`repository` are **optional**, and each
      description contains the **literal configured value**
- [ ] Without defaults: they are **required**, and nothing promises a fallback

That last pair is the repo's central convention — see the
[three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule).

### 3. Behaviour

For each tool:

- [ ] A valid call returns the documented compact shape
- [ ] Omitted parameters fall back correctly
- [ ] An invalid parameter is rejected with a useful message, not a crash
- [ ] A missing owner/repository with no default throws the documented error
- [ ] A nonexistent resource yields an actionable message
- [ ] Lists carry `returned` and a truncation signal — `totalCount` when the
      endpoint reports one, otherwise `truncated`
      ([T18 exception](../04-contracts/tool-contract.md#responses))
- [ ] No raw API payload reaches the output
- [ ] No credential appears in any response or error

### 4. Read-only

- [ ] Every Octokit call in the diff is a read
- [ ] No `.create`, `.update`, `.delete`, `.add`, `.remove`, `.merge`

```bash
grep -rn "octokit\.rest" tools/*/src/ | grep -Ev "\.(get|list|search)"
```

Non-empty output needs an ADR superseding
[ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md).

### 5. Model behaviour

Structural correctness is not sufficient — a tool the model misuses is broken.
Run at least the reference scenario:
[github-list-issues](../05-harness/scenarios/github-list-issues/scenario.md),
scored with the [rubric](../05-harness/eval-rubric.md).

- [ ] The model calls the right tool, first try
- [ ] **It asks no clarifying question when defaults are configured**

### 6. Secrets

- [ ] `git status --porcelain | grep -i '\.env$'` is empty
- [ ] `.env.example` values are empty
- [ ] Fixtures are synthetic

Full list: [security and secrets](../04-contracts/security-and-secrets.md#review-checklist).

---

## What to automate first

In value order — details in [harness overview](../05-harness/overview.md) and
[principles](../05-harness/principles.md):

1. **`tsc --noEmit`** as a `typecheck` script. Cheapest, and there is currently
   no compile-time gate whatsoever.
2. **Mapper and query-builder tests** against
   [fixtures](../05-harness/fixtures/github/README.md) — pure functions, no MCP, no network.
3. **Description/schema tests**: a configured server makes `owner` optional and
   interpolates the value; an unconfigured one does neither.
4. **A registration sanity test**: every entry in `TOOL_INSTANCES` has a
   substantial description and no `TODO` in its source. This alone would have
   caught `list_github_milestones_by_repo` shipping as scaffold.
5. Handler tests with a stubbed `config.octokit`.

Evals stay manual and advisory — they must never gate a commit.
