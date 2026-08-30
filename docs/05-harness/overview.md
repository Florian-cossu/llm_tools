---
type: harness
status: planned
scope: repo
last_reviewed: 2026-08-30
summary: PLANNED - the intended testing and evaluation harness. No runner exists today.
read_when:
  - building the test or eval harness
  - you need to know what verification actually exists right now
code_refs:
  - package.json
tags:
  - harness
  - planned
  - testing
---

# Harness overview

> [!warning] Not implemented
> **There is no test suite and no eval runner in this repository.**
> The `bun test` **runner** matches **zero files** — it exits successfully
> having run nothing, which is worse than failing. (The root `test` *script*,
> `bun run test`, is a different thing: a clean reinstall plus `check-docs.mjs`.
> It also runs no tests.) Everything below describes intent, not reality. Do not
> report any of it as existing.

## What verification exists today

Manual only:

| Method | Covers | Where |
| --- | --- | --- |
| MCP Inspector | Server starts, tools listed, calls return | [local development](../06-workflows/local-development.md) |
| Prompting a real model | Whether the model *uses* the tools correctly | [eval rubric](eval-rubric.md) |
| Code review | Read-only guarantee, contract conformance | [tool contract](../04-contracts/tool-contract.md#review-checklist) |
| Reading `stderr` | Startup and call failures | [observability](observability.md) |

The checklist in [testing](../06-workflows/testing.md) is the real, current
procedure.

## Why two kinds of testing are needed

This repo has an unusual property: **a tool can be perfectly correct and still
broken**, because the consumer is a language model. A tool that returns exactly
the right JSON but whose description makes the model ask the user for the
repository has failed at its job.

So the intended harness has two halves:

| | Deterministic tests | Evaluations |
| --- | --- | --- |
| **Question** | Does the code do the right thing? | Does the *model* do the right thing? |
| **Subject** | Mappers, query builders, guards, handlers | Descriptions, instructions, schemas |
| **Input** | [Fixtures](fixtures/github/README.md) | Prompts + a real model |
| **Output** | Pass/fail | Scored against a [rubric](eval-rubric.md) |
| **Speed** | Milliseconds | Seconds, and non-deterministic |
| **Gates a commit** | Should | Cannot — advisory |

## Intended scope

**Deterministic** — pure functions first, they are the cheapest wins:

- `mapGithubIssue`, `mapGithubMilestone`, `mapGithubLabelNames`, including the
  API quirks in [data schemas](../04-contracts/data-schemas.md): absent
  `assignees`, polymorphic `labels`, nameless labels.
- `buildIssueSearchQuery`, especially that `state:all` emits **no** qualifier.
- `stringOrNull` / `isStringUsable` on unset vs empty vs whitespace.
- `describeDefault` / `optionalWhenConfigured` / `describeConfiguredRepository`
  — including that an unconfigured server promises nothing.
- Handlers against fixtures with a stubbed Octokit: default resolution, the
  missing-credentials throw, envelope construction.

**Evaluative** — [scenarios](scenarios/README.md), scored by the
[rubric](eval-rubric.md). The decisive case: *"list the open issues"* with
defaults configured must produce an answer with **no clarifying question**.

## Building it

1. Add deterministic tests for the pure functions — no new dependency, `bun
   test` picks up `*.test.ts`. This alone would have caught the
   `list_github_milestones_by_repo` scaffold.
2. Add handler tests with a stubbed `config.octokit`, fed by
   [fixtures](fixtures/github/README.md).
3. Add a `typecheck` script (`tsc --noEmit`) — with no build step there is
   currently **no compile-time gate at all**
   ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md#consequences)).
4. Only then automate the evals; they are the expensive, least reliable part.

Tracked in [current plan](../07-plans/current.md).

## Related

[Principles](principles.md) · [Failure modes](failure-modes.md) ·
[Observability](observability.md) · [Testing workflow](../06-workflows/testing.md)
