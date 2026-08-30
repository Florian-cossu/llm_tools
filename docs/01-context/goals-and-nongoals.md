---
type: context
status: active
scope: repo
last_reviewed: 2026-08-30
summary: What llm_tools is trying to be, and the things it deliberately refuses to become.
read_when:
  - proposing a feature, dependency or architectural change
  - judging whether something belongs in this repository
code_refs:
  - README.md
tags:
  - context
  - scope
---

# Goals and non-goals

A change that serves a goal is worth arguing about. A change that crosses a
non-goal needs an [ADR](../03-decisions/README.md) before it is worth arguing
about.

## Goals

1. **Give a local model useful, correct tools.** Correctness includes the model
   calling the tool properly — a tool a small model misuses is a broken tool.
   See [agent contract](../04-contracts/agent-contract.md).
2. **Stay cheap on context.** Every response is mapped to a compact shape.
   See [data schemas](../04-contracts/data-schemas.md).
3. **Keep credentials on the machine.** Local process, local `.env`, no proxy.
   See [security model](../02-architecture/security-model.md).
4. **Make a new server boring to add.** Scaffold, fill two TODOs, register.
   See [tool package](../02-architecture/components/tool-package.md).
5. **Stay runtime-agnostic at the orchestration layer.** `tool.json` describes
   how a server installs and launches, so a Python or Go server drops in
   without touching the scripts.
   See [setup and registration](../02-architecture/components/setup-and-registration.md).
6. **Default to read-only.** See [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md).

## Non-goals

| Not doing | Why | Decision |
| --- | --- | --- |
| Hosting servers, or an HTTP/SSE transport | Local stdio keeps credentials local and the setup trivial | [ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md) |
| A build/bundle step | Bun runs TypeScript directly; a build is one more thing to break between edit and restart | [ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md) |
| One mega-server fronting every integration | Credentials, rate limits and failure blast radius stay separated per integration | [ADR-0004](../03-decisions/ADR-0004-server-per-integration.md) |
| Write operations by default | An LLM calling a destructive tool unprompted is the failure this repo refuses | [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) |
| Being a general-purpose GitHub client | Only the endpoints a model actually needs, in the shape it can use | [github API](../04-contracts/github-api.md) |
| Publishing to npm, or a plugin marketplace | Personal tooling, cloned and run in place | — |
| Multi-user, auth, or tenancy | One machine, one user, one `.env` | [ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md) |
| Pagination cursors in tool responses | A small model handles "raise the limit" better than it handles cursor state | [tool contract](../04-contracts/tool-contract.md) |

## Deliberately unresolved

These are neither goals nor non-goals yet — they are open. See
[current plan](../07-plans/current.md).

- Automated testing and an eval harness ([05-harness](../05-harness/overview.md), all `status: planned`).
- Whether write tools ever get added behind an explicit opt-in.
