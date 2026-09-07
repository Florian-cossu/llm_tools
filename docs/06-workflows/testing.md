---
type: workflow
status: draft
scope: repo
last_reviewed: 2026-09-01
last_updated: 2026-09-03
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
> rm -rf node_modules && node scripts/check-docs.mjs && bun install \
>   && bun run typecheck && node scripts/check-deps.mjs
> ```
>
> That validates the docs vault, proves the workspace installs from clean, and
> type-checks the whole workspace — worth running, and the check that catches a
> dependency missing from the root `package.json` since
> [ADR-0005](../03-decisions/ADR-0005-root-dependencies.md). It still runs **no
> tests**: it proves the code *compiles*, not that it is correct. Do not read a
> green `bun run test` as "the code works".
>
> Run `bun run setup` first, so the client registration matches the tree you are
> about to validate.

> [!warning] `tsc` must be the real compiler
> `npx tsc` will happily run the **deprecated `tsc` npm package** if it is
> installed — it prints *"This is not the tsc command you are looking for"* and
> **exits 0**, so the step passes having checked nothing. The script therefore
> calls `bun run typecheck`, which resolves `tsc` from the `typescript`
> devDependency. If the typecheck ever runs instantly and silently, check what
> `node_modules/.bin/tsc` points at.

The checklist below is the actual gate.

---

## Manual validation

### 0. Workspace

```bash
bun run setup       # register every server against the current tree
bun run test        # docs + clean install + typecheck + dependency layout. Runs no tests
bun run typecheck   # just the types, when that is all you changed
```

Four steps, each failing loudly:

- [ ] `check-docs.mjs` passes
- [ ] The install completes from clean — a dependency used but missing from the
      root `package.json` shows up here
- [ ] `bun run typecheck` passes — the workspace compiles, source Bun runs
      included
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

- [ ] Every Octokit call in the diff matches its tool's declared `TOOL_EFFECT`
- [ ] No `.delete`, `.remove`, `.merge` — those are `destructive`, and no tool
      may declare that yet. `.create` and `.update` are `write`: they have a
      compensating action, so [D3](../03-decisions/ADR-0007-writes-behind-declared-capability.md)
      allows them

```bash
grep -rn "octokit\.rest" tools/*/src/ | grep -Ev "\.(get|list|search)"
```

Every line of output must come from a file declaring `TOOL_EFFECT = "write"`.
Today that is exactly two: `create_github_label` calling `issues.createLabel`,
and `update_github_label` calling `issues.updateLabel`. A mutating call in a
file declaring `read` is a contract violation
([ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)) —
and the likeliest one to reach review, since a tool scaffolded from a read keeps
`read` until someone changes it.

- [ ] With `GITHUB_ALLOW_WRITES` unset, the server logs
      `Not registering create_github_label` and
      `Not registering update_github_label` to **stderr** and the model's tool
      list has six entries
- [ ] With it set, the tool list has eight and the server instructions **name
      both write tools** rather than promising read-only

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

1. **Mapper and query-builder tests** against
   [fixtures](../05-harness/fixtures/github/README.md) — pure functions, no MCP, no network.
2. **Description/schema tests**: a configured server makes `owner` optional and
   interpolates the value; an unconfigured one does neither.
3. **A registration sanity test**: every entry in `TOOL_REGISTRATIONS` has a
   substantial description and no `TODO` in its source. This alone would have
   caught `list_github_milestones` shipping as scaffold. Extend it to the
   effect class — a tool declaring `read` whose source calls anything but
   `.get`/`.list`/`.search` should fail the test.
4. Handler tests with a stubbed `config.octokit`.

`tsc --noEmit`, which used to head this list, is done — it is `bun run
typecheck`, inside `bun run test`.

Evals stay manual and advisory — they must never gate a commit.
