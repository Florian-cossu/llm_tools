---
type: plan
status: draft
scope: repo
last_reviewed: 2026-08-30
summary: NOT AUTHORITATIVE - what is half-finished right now and what is worth doing next.
read_when:
  - picking up work
  - you found something broken and want to know if it is known
tags:
  - plan
  - wip
---

# Current plan

> [!warning] Not authoritative
> Intent, not fact. Code and [contracts](../04-contracts/README.md) win over anything
> here — see [conventions](../00-conventions.md).

## Known broken

### `bun test` is a false green

No test files exist; the runner exits successfully having run nothing. Note this
is **`bun test`**, not `bun run test` — the latter now runs a clean reinstall
plus `check-docs.mjs`, which is real work but still runs no tests.
See [testing](../06-workflows/testing.md).

## Smaller defects

| Item | Where |
| --- | --- |
| Read-only paragraph commented out, so the model may ask permission for every read | `server_instructions.ts` |
| No CI, so `bun run test` only runs when someone remembers to | — |
| No eval scenario for either milestone tool, and the one that exists is `status: planned` | `docs/05-harness/scenarios/` |
| No milestone fixtures, so the mappers have nothing to be tested against | `docs/05-harness/fixtures/github/` |

## Next, in value order

1. **Add `tsc --noEmit` as a `typecheck` script.** Cheapest possible win: with
   no build step there is currently no compile-time gate at all
   ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md#consequences)). It has
   already earned its keep — run by hand, it is what confirmed the milestone
   handler fixes compiled.
2. **Test the pure functions** — mappers, `buildIssueSearchQuery`, the string
   guards — against the [fixtures](../05-harness/fixtures/github/README.md), which already
   encode the awkward cases. Milestone fixtures still need writing.
3. **Add the registration sanity test** (every `TOOL_INSTANCES` entry has a real
   description and no `TODO`). This is what would have caught the milestone
   scaffold before it shipped registered.
4. **Re-enable the read-only instruction paragraph** and re-run the
   [scenario](../05-harness/scenarios/github-list-issues/scenario.md).
5. **Description/schema tests** for the
   [three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule)
   — the repo's most important convention, currently unverified.

## Open questions

- Do write tools ever get added, and behind what gate? An `.env` opt-in composes
  well with startup-time registration — see
  [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md#alternatives).
- Is a second integration close enough to matter? It would test whether
  `@llm-tools/shared` generalises beyond GitHub.
- Should milestone progress counts be in the compact shape by default? They now
  live in the **detail** shape only
  ([data schemas](../04-contracts/data-schemas.md#milestone-detail)), so a list
  answers "which milestones exist" but never "how far along is each one".
- Is a boolean `truncated` the right answer for a list whose endpoint reports no
  total, or should such tools count pages to get a real one?
  ([T18 exception](../04-contracts/tool-contract.md#responses))

## Done

- **`list_github_milestones_by_repo` finished.** Was registered scaffold calling
  `issues.get`; now calls `issues.listMilestones`, maps through
  `mapGithubMilestone`, and returns `{ returned, truncated, milestones }`. Two
  defects were found in the half-written version while finishing it: `limit` was
  passed to Octokit as `limit` rather than `per_page`, so it was silently
  ignored; and the `map` callback had no `return`, so the payload was
  `[null, null, …]`.
- **`get_github_milestone` completed.** Stale `// TODO` removed, description
  brought up to T11, and `openIssues` / `closedIssues` added — until then it
  returned exactly what the list tool returns for every milestone, so it had no
  reason to exist.
- **`check-deps.mjs` added**, wired into `bun run test` alongside
  `bun install --frozen-lockfile`. Enforces
  [ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever) on every run: no pins, no
  third-party declarations in workspace manifests, no shadowing nested trees, no
  duplicate installs, no lockfile drift. `bun run deps:reset` is the deliberate
  escape hatch. `typescript` also moved to `devDependencies`.
- **`zod` deduplicated to a single root install.** It resolved three ways at
  once — a stale `tools/github/node_modules/`, a second range in
  `tools/shared/package.json`, and a stale transitive resolution in the
  lockfile. Fixed by removing all three causes and regenerating `bun.lock` from
  clean; **no `overrides`, no pin**
  ([ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever)).
- Documentation vault built out under `docs/` — [index](../00-index.md).
- Docs given frontmatter and cross-links — [conventions](../00-conventions.md).
