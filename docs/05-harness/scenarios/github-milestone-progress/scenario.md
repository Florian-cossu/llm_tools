---
type: harness
status: planned
scope: github
last_reviewed: 2026-08-30
summary: PLANNED - the milestone evaluation scenario, checking a model chains list to get instead of guessing a milestone number.
read_when:
  - running an evaluation by hand
  - after changing either milestone tool's description
code_refs:
  - tools/github/src/toolbox/tools/list_github_milestones_by_repo.ts
  - tools/github/src/toolbox/tools/get_github_milestone.ts
tags:
  - harness
  - planned
  - evaluation
  - github
  - milestones
---

# Scenario: milestone progress

> [!warning] No runner
> Run by hand and scored against the [rubric](../../eval-rubric.md).
> `expected-output.json` is written for a future runner and is not consumed by
> anything today.

The milestone counterpart to
[github-list-issues](../github-list-issues/scenario.md). Where that one measures
**autonomy**, this one measures **chaining**: the user names a milestone by
title, and only `list_github_milestones_by_repo` can turn a title into the
number `get_github_milestone` needs.

It exists because milestones carry a trap issues do not — **milestone numbers
are a separate sequence from issue numbers**. A model that pattern-matches from
the issue tools will pass an issue number to `get_github_milestone` and get a
plausible answer about the wrong object, or a 404.

## Preconditions

`.env` fully configured, server restarted, fresh chat, tool-capable model — as
in the [reference scenario](../github-list-issues/scenario.md#preconditions).
The repository must have **at least one open milestone with a title**, and the
model must not have been told any milestone number earlier in the chat.

## Prompt

> How far along is the v1.2 milestone?

Verbatim. A title, never a number.

## Expected behaviour

1. **`list_github_milestones_by_repo` first** — the title must be resolved to a
   number before anything else.
2. Arguments omit `owner` and `repository`; `state` omitted or `"all"`, since a
   milestone asked about by name may already be closed.
3. **Then one** `get_github_milestone` call, with the `number` taken from the
   matching row of the previous result.
4. **No question to the user**, and no guessed number.
5. The answer quotes `openIssues` / `closedIssues` — the list step alone cannot
   answer "how far along", which is the point of the chain.
6. No claim about *which* issues are in the milestone; neither tool returns them.

```json
{ "state": "all" }
```
```json
{ "number": 3 }
```

## Failure signals

| Observed | Diagnosis |
| --- | --- |
| `get_github_milestone` called first, with a guessed number | **The failure this scenario exists to catch.** The description's "not the number of an issue it contains" line is not landing |
| A number lifted from an issue discussed earlier in the chat | Same defect, worse — milestone and issue sequences conflated |
| Only the list call, then an answer about progress | D4 — the compact shape carries no counts, so the answer is invented |
| `list_github_issues` with `milestone:"v1.2"` and counting rows by hand | Not wrong, but wasteful and rate-limited; `get_github_milestone` answers directly |
| "Which repository?" | D2 — a default is missing, or the server was not restarted. See the [reference scenario](../github-list-issues/scenario.md) |
| Model reports a total count for the milestone list | D4 — there is no `totalCount` on this tool, only `truncated` |

## Scoring

All six [rubric](../../eval-rubric.md) dimensions apply; **D5 (chaining) is the
one this scenario exists to measure.** A model that answers correctly only
because it guessed the right number scores 0 on D5 — check the call sequence,
not the prose.

## Variants worth running

| Prompt | Adds |
| --- | --- |
| "What milestone is due next?" | `sortBy: "due_on"` with `sortOrder: "asc"` — the non-default direction |
| "List every milestone, closed ones included." | `state: "all"`, and no chain at all — a model that still calls `get_github_milestone` per row fails D6 |
| "Is v1.0 finished?" | The closed-≠-complete trap: v1.0 is closed with open issues outstanding |
| "What's in milestone v1.2?" | Must cross to `list_github_issues` with `milestone:"v1.2"` — neither milestone tool returns issues |
