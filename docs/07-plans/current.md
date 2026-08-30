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

### `list_github_milestones_by_repo` is registered scaffold

The tool is in `TOOL_INSTANCES`, so the model can and will call it, but it is
the untouched output of `add-new-implementation.mjs`:

- calls `octokit.rest.issues.get` — the **issue** endpoint;
- takes `number`, described as *"the issue within its repository"*;
- returns the raw payload, no mapper;
- description truncated mid-sentence, ending in a bare colon.

Violates the [tool contract](../04-contracts/tool-contract.md) at T11, T13, T17
and the no-scaffold rule.

**Fix:** schema of `state` / `sort` / `direction` / `limit`; call
`issues.listMilestones`; map through `mapGithubMilestone`; return a
`{ totalCount, returned, milestones }` envelope; write the description properly.
Worth adding `open_issues` / `closed_issues` to the compact milestone at the
same time — a milestone list without progress counts answers little
([data schemas](../04-contracts/data-schemas.md#milestone)).

**Meanwhile:** either finish it or remove it from `TOOL_INSTANCES`. Leaving a
broken tool registered is worse than not shipping it.

### `bun test` is a false green

No test files exist; the command exits successfully having run nothing. It is
advertised in [`CLAUDE.md`](../../CLAUDE.md) and the root README.
See [testing](../06-workflows/testing.md).

## Smaller defects

| Item | Where |
| --- | --- |
| Read-only paragraph commented out, so the model may ask permission for every read | `server_instructions.ts` |
| Stale `// TODO: call the GitHub API…` above a finished call | `get_github_milestone.ts` |
| `get_github_milestone`'s description is one line and does not state its response shape (T11) | `get_github_milestone.ts` |
| Root README lists `list_github_milestones_by_repo` without marking it broken in the table itself | `README.md` |

## Next, in value order

1. **Finish or unregister `list_github_milestones_by_repo`.** It is the only
   thing here a user can actually hit.
2. **Add `tsc --noEmit` as a `typecheck` script.** Cheapest possible win: with
   no build step there is currently no compile-time gate at all
   ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md#consequences)).
3. **Test the pure functions** — mappers, `buildIssueSearchQuery`, the string
   guards — against the [fixtures](../05-harness/fixtures/github/README.md), which already
   encode the awkward cases.
4. **Add the registration sanity test** (every `TOOL_INSTANCES` entry has a real
   description and no `TODO`). This would have caught defect #1.
5. **Re-enable the read-only instruction paragraph** and re-run the
   [scenario](../05-harness/scenarios/github-list-issues/scenario.md).
6. **Description/schema tests** for the
   [three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule)
   — the repo's most important convention, currently unverified.

## Open questions

- Do write tools ever get added, and behind what gate? An `.env` opt-in composes
  well with startup-time registration — see
  [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md#alternatives).
- Is a second integration close enough to matter? It would test whether
  `@llm-tools/shared` generalises beyond GitHub.
- Should milestone progress counts be in the compact shape by default?

## Done

- Documentation vault built out under `docs/` — [index](../00-index.md).
- Docs given frontmatter and cross-links — [conventions](../00-conventions.md).
