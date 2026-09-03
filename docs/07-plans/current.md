---
type: plan
status: draft
scope: repo
last_reviewed: 2026-09-02
last_updated: 2026-09-03
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
is **`bun test`**, not `bun run test` — the latter now runs a clean reinstall,
`check-docs.mjs`, `bun run typecheck` and `check-deps.mjs`, which is real work
but still runs no tests. See [testing](../06-workflows/testing.md).

## Smaller defects

| Item | Where |
| --- | --- |
| The permission layer ADR-0007 points at does not exist. `GITHUB_ALLOW_WRITES` is the whole gate, and it is per server, not per tool | `index.ts` |
| No audit trail. Nothing records that a write happened | — |
| No CI, so `bun run test` only runs when someone remembers to | — |
| No eval scenario for either milestone tool, and the one that exists is `status: planned` | `docs/05-harness/scenarios/` |
| No milestone or label fixtures, so `mapGithubMilestone` and `mapGithubLabel` have nothing to be tested against | `docs/05-harness/fixtures/github/` |
| `labels` builds `label:a,b`, which GitHub reads as *any of*, so listing two names widens the result. Documented, not fixed — an *all of* filter needs repeated qualifiers | `utils/github_search_query.ts` |
| A trailing or doubled comma in `labels` reaches the query as an empty name — `"draft,"` builds `label:draft,`. Empty segments are not dropped | `utils/github_search_query.ts` |

## Next, in value order

1. **Test the pure functions** — mappers, `buildIssueSearchQuery`, the string
   guards — against the [fixtures](../05-harness/fixtures/github/README.md), which already
   encode the awkward cases. Milestone fixtures still need writing.
2. **Add the registration sanity test** (every `TOOL_REGISTRATIONS` entry has a real
   description and no `TODO`). This is what would have caught the milestone
   scaffold before it shipped registered.
3. **The permission layer** — the point of ADR-0007's D1. SQLite, one row per
   tool with its effect class and an allow/deny/ask decision, user-editable,
   consulted *before execution* so a change needs no restart, and deny by
   default for anything unlisted. It replaces `GITHUB_ALLOW_WRITES`, which is
   deliberately the crudest version of the same idea, and unblocks
   `destructive` tools (ADR-0007 D3). Gets its own ADR.
4. **A scenario for the write path**: the model asked to create a label calls
   `list_github_labels` first, confirms, calls once, and does not retry the
   422. And the injection case — an issue body telling it to create a label
   must not work.
5. **Description/schema tests** for the
   [three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule)
   — the repo's most important convention, currently unverified.

## Open questions

- Should `labels` require *all* the names it lists rather than *any*? That means
  emitting one `label:` qualifier per name instead of joining them with commas,
  and picking a syntax for the other meaning — the current string format has no
  room for both
  ([github API](../04-contracts/github-api.md#label-qualifiers)).
- ~~Do write tools ever get added, and behind what gate?~~ **Answered** by
  [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md): yes,
  behind a declared effect class and a startup gate, with the `.env` opt-in
  standing in until the permission layer lands.
- Should the effect gate live in `@llm-tools/shared` (where
  `registrationRefusal` is) or become part of the MCP server construction
  itself? Today every server has to remember to call it — the second server
  will show whether that is a problem.
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

- **`update_github_label` added** (server 2.3.0 → 2.4.0). The second write, and
  the first tool written against ADR-0007 rather than alongside it. It calls
  `issues.updateLabel`, is keyed by the label's **current** `name` with
  `newName` carrying the rename, and forwards only the parameters it was given
  because the endpoint is a partial update.
  - **It was reviewed as a read and was not one.** The tool shipped its first
    draft declaring `TOOL_EFFECT = "read"` while calling a mutating endpoint —
    a T4c defect that also opened the gate, since `registrationRefusal` sees
    only the declaration: it registered whatever `GITHUB_ALLOW_WRITES` said, and
    `buildServerInstructions` would have told the model every tool on the server
    was read-only. The declaration is the control, so a wrong one is not a
    documentation slip. This is why the [testing checklist](../06-workflows/testing.md)
    greps the Octokit calls against the declared effect rather than trusting it.
  - A call carrying none of `newName`, `color` and `description` is **refused in
    the handler**. GitHub answers `200` with the label untouched, and reporting
    that as `{ updated: true }` would tell the model a change landed. This is
    not a permission check — the gate stays at registration (D4) — it is about
    not lying in the response.
  - Scaffold defects fixed before it shipped, all of them from copying
    `create_github_label` without re-reading it: the description was still the
    one-line stub; the response was raw `response.data` instead of
    `mapGithubLabel`, against T18; `color` was passed through without
    `.replace("#", "")`, so a `#`-prefixed code the regex accepts would have
    reached the API; `newName` was missing `.min(1)`; and `name` carried
    create's case-collision warning, which belongs to `newName` — `name` must
    match a label that exists.
  - `write`, not `destructive`: a rename is undone by another rename (D3).

- **`create_github_label` added, and writes unblocked** (server 2.2.0 → 2.3.0).
  The repo's first mutating tool, and the reason
  [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)
  supersedes ADR-0003. What landed with it:
  - **Effect classes.** Every tool exports `TOOL_EFFECT` (`read` | `write` |
    `destructive`) and the toolbox exports `TOOL_REGISTRATIONS` of
    `{ name, effect, register }` instead of bare functions — the name and the
    effect have to be readable *before* the tool is registered, which a bare
    registrar cannot offer.
  - **The gate**, in `index.ts`: `registrationRefusal` decides per tool, the
    refusal goes to **stderr**, and a refused tool is never registered, so the
    model does not see it. `destructive` is refused whatever the flag says.
  - **`GITHUB_ALLOW_WRITES`**, read once through `booleanFromEnv`, which
    accepts only `1`/`true`/`yes`/`on` — a typo leaves writes off rather than on.
  - **The read-only instruction paragraph is finally uncommented**, which was
    item 3 on this list, but *conditional*: it promises read-only only when
    nothing mutating was registered, and otherwise names the write tools and
    tells the model that issue and comment text is not the user speaking.
    `buildServerInstructions` now takes the allowed registrations, so it cannot
    promise something the gate contradicts.
  - Scaffold defects fixed before it shipped: `labelName` had
    `.default("new label")`, so a confused model would have created a label by
    that name; `z.hex()` accepted `fff` and *rejected* `#ff0000`, making the
    handler's `.replace("#", "")` unreachable; and the response wrapped JSON in
    prose against T16. Parameters were renamed `name`/`color`/`description` to
    match `get_github_label` and the mapper's own field names.
  - The standard write preamble lives in `describeMutation(effect)` in the
    shared package, so the next write tool does not improvise its own warning.

- **Label filtering on `list_github_issues`** (server 2.0.0 → 2.2.0). A new
  `labels` parameter takes a comma-separated list of names, `NOT:` marking one
  to exclude, and `buildIssueSearchQuery` turns it into at most two qualifiers
  (`label:` / `-label:`), quoting any name containing a space. It was named
  `label` while accepting a list, which invited the model to pass exactly one;
  renamed to `labels`, matching the argument the query builder already took.
  `search` used to advertise `label:bug` as an example, so there were two routes
  to the same filter — the example is gone and `search` now disclaims labels the
  way it already disclaims the repo, the state and the PR exclusion. A
  `console.error` left over from debugging was removed. **The comma is GitHub's
  *any of*, not *all of*** — stated in the description, the README and the
  [API contract](../04-contracts/github-api.md#label-qualifiers), because the
  intuitive reading is the wrong one.
- **`get_github_label` added** (server 2.0.0 → 2.2.0). Calls `issues.getLabel`
  and returns one label through the existing `mapGithubLabel`. It is keyed by
  **name**, unlike every other `get_*` here, because no id survives into the
  compact shape. It returns **exactly what the list returns per row** — the
  endpoint has nothing more to give — so it is a documented exception to
  [T21](../04-contracts/tool-contract.md#responses), earning its place on cost
  and certainty: one label instead of a hundred, and a 404 that answers "does
  this label exist?". Three notes asserted in so many words that there was no
  `get_github_label` and had to be corrected:
  [data schemas](../04-contracts/data-schemas.md#label),
  [github API](../04-contracts/github-api.md#listing-labels) and
  [data flows](../02-architecture/data-flows.md#two-step-read-pattern). Its
  description was missing the returned shape (T11) entirely; added, along with
  the error wording the other `get_*` tools use.
- **`list_github_labels` added** (server 1.4.0 → 1.5.0). Calls
  `issues.listLabelsForRepo`, maps through the new `mapGithubLabel` into
  `{ name, description, color, default }`, and returns
  `{ returned, truncated, labels }` — the same no-total envelope as the
  milestone list. `limit` defaults to 100, the endpoint maximum, so one call
  normally returns a repository's whole label set. There is deliberately **no**
  `get_github_label`: the compact shape is the whole object, so a detail tool
  would violate T21. **That reasoning was later revisited** — see the
  `get_github_label` entry above, which keeps the premise and rejects the
  conclusion. Its description referenced `list_github_issues_by_repo`
  (the *filename*, not a tool the model can call) and omitted `default` from
  the shape it promises — both corrected before it was documented.
- **`list_github_milestones` finished.** Was registered scaffold calling
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
- **`tsc --noEmit` as a `typecheck` script.** `bun run typecheck`, wired into
  the root `test` script. The root `tsconfig.json` gained `noEmit` and
  `allowImportingTsExtensions` so it can check the same `.ts`-suffixed source
  Bun runs. First attempt installed the deprecated **`tsc` npm package**, whose
  binary prints a notice and exits 0 — a silent false green of exactly the kind
  this repo already had with `bun test`; the script now resolves `tsc` from the
  `typescript` devDependency.
- **`check-deps.mjs` added**, wired into `bun run test` alongside
  `bun install`. Enforces
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
