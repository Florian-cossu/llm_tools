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

> [!warning] `bun test` currently proves nothing
> There are **no test files** in this repository. `bun test` matches zero files
> and exits **successfully**, having verified nothing — a green result that
> means nothing at all. It is listed as a command in
> [`CLAUDE.md`](../../CLAUDE.md) and in the root README; treat both as
> aspirational until a suite exists
> ([harness overview](../05-harness/overview.md)).
>
> There is also **no type-check step**: with no build
> ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md)), nothing checks types
> before runtime.

The checklist below is the actual gate.

---

## Manual validation

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
- [ ] Lists carry `totalCount` and `returned`; truncation is visible
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
