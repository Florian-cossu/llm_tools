---
type: index
status: planned
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Index of evaluation scenarios - prompt-level cases scored against the rubric, run by hand.
tags:
  - index
  - harness
  - planned
---

# Scenarios

One folder per case. Each holds a `scenario.md` (the human procedure) plus
`input.json`, `expected-output.json` and `metadata.yml` written for a future
runner — **nothing consumes them today**
([overview](../overview.md)).

| Scenario | Measures |
| --- | --- |
| [github-list-issues](github-list-issues/scenario.md) | **Autonomy** — the model lists open issues without asking which repository |
| [github-milestone-progress](github-milestone-progress/scenario.md) | **Chaining** — the model resolves a milestone title to a number before reading it, rather than guessing |

Scored with the [eval rubric](../eval-rubric.md). Evals are advisory and must
never gate a commit.

## Adding one

Copy the folder, keep the four filenames, and give it a single behaviour to
measure. A scenario testing two things tells you nothing when it fails.
