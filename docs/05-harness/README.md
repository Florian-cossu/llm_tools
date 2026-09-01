---
type: index
status: planned
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Index of the harness - mostly planned; only failure modes reflects reality today.
tags:
  - index
  - harness
  - planned
---

# 05-harness

Testing, evaluation and observability.

> [!warning] Mostly not implemented
> **No test suite, no eval runner.** The `bun test` runner matches zero files;
> `bun run test` is a reinstall-and-validate script, not a test run. Check each
> note's `status` before treating it as fact.

| Note | Status | Covers |
| --- | --- | --- |
| [Overview](overview.md) | planned | The intended harness, and what verification exists today |
| [Principles](principles.md) | planned | Rules the first tests should follow |
| [Failure modes](failure-modes.md) | **active** | How things actually break, by layer |
| [Observability](observability.md) | draft | The `stderr` discipline, and what can be seen |
| [Eval rubric](eval-rubric.md) | planned | Scoring whether a *model* uses the tools well |
| [scenarios/](scenarios/README.md) | planned | Prompt-level test cases |
| [fixtures/](fixtures/github/README.md) | draft | Synthetic API payloads |

The actual current procedure: [testing](../06-workflows/testing.md).
