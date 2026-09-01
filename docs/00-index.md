---
type: index
status: active
scope: repo
last_reviewed: 2026-09-01
last_updated: 2026-09-01
summary: Entry point for the llm_tools documentation vault - routes a task to the notes that answer it.
read_when:
  - starting any task in this repository
  - you do not know which note holds the answer
code_refs:
  - CLAUDE.md
  - README.md
tags:
  - index
  - moc
---

# Documentation index

Documentation for **llm_tools** — a collection of local, stdio-based
[MCP](01-context/glossary.md#mcp) servers that expose custom tools to a local LLM runtime.

This vault is a *map of content*: start here, follow the route for your task,
and stop reading once the question is answered. Every note declares in its
frontmatter what it is (`type`), whether it can be trusted (`status`) and when
it is worth opening (`read_when`).

New to the vault itself? Read [vault conventions](00-conventions.md) first.

---

## Route by task

| Your task | Read, in order |
| --- | --- |
| Understand what this repo is | [Project overview](01-context/project-overview.md) → [System overview](02-architecture/system-overview.md) |
| Add a **tool** to an existing server | [Tool contract](04-contracts/tool-contract.md) → [Tool package](02-architecture/components/tool-package.md) → the server's note, e.g. [github server](02-architecture/components/github-server.md) |
| Add a **new server** | [MCP server contract](04-contracts/mcp-server-contract.md) → [Tool package](02-architecture/components/tool-package.md) → [Setup and registration](02-architecture/components/setup-and-registration.md) |
| Make a tool the model actually calls correctly | [Agent contract](04-contracts/agent-contract.md) → [Shared package](02-architecture/components/shared-package.md) |
| Change a response shape | [Data schemas](04-contracts/data-schemas.md) → [Data flows](02-architecture/data-flows.md) |
| Touch credentials or tokens | [Security and secrets](04-contracts/security-and-secrets.md) → [Security model](02-architecture/security-model.md) → [ADR-0003](03-decisions/ADR-0003-read-only-by-default.md) |
| Work against the GitHub API | [GitHub API contract](04-contracts/github-api.md) → [github server](02-architecture/components/github-server.md) |
| The server won't start or the model ignores it | [Debugging](06-workflows/debugging.md) → [Failure modes](05-harness/failure-modes.md) |
| Run things locally | [Local development](06-workflows/local-development.md) |
| Change a cross-cutting decision | [Decisions index](03-decisions/README.md) → write a new ADR |
| Know what is half-finished right now | [Current plan](07-plans/current.md) |

---

## By folder

| Folder | Holds | Authoritative? |
| --- | --- | --- |
| [01-context](01-context/README.md) | Why the project exists, its limits, its vocabulary | Yes |
| [02-architecture](02-architecture/README.md) | How the pieces fit and what each one does | Yes, but code wins |
| [03-decisions](03-decisions/README.md) | ADRs — the *rationale* behind the architecture | **Yes** |
| [04-contracts](04-contracts/README.md) | Interfaces that must hold: MCP, tools, schemas, secrets | **Yes** |
| [05-harness](05-harness/README.md) | Testing, evaluation, observability | Mostly **planned** |
| [06-workflows](06-workflows/README.md) | Step-by-step operating instructions | Yes |
| [07-plans](07-plans/README.md) | Work in progress and intent | **No** |
| [90-generated](90-generated/README.md) | Machine-written docs | Never edit by hand |
| [99-archive](99-archive/README.md) | Superseded material, kept for history | **No** |

---

## Source of truth

When two sources disagree, the higher one wins:

1. **Source code and tests** — implemented behaviour.
2. **[04-contracts](04-contracts/README.md)** — the interfaces behaviour must respect.
3. **[03-decisions](03-decisions/README.md)** — why the architecture is what it is.
4. **[02-architecture](02-architecture/README.md)** — the descriptive map.
5. **[06-workflows](06-workflows/README.md)** — operating instructions.

`07-plans/` and `99-archive/` are never authoritative. `90-generated/` is
authoritative about its source, but is never edited by hand.

---

## Current state, briefly

- One server ships: [github](02-architecture/components/github-server.md), read-only, version 2.0.0.
- All five of its tools are complete — `list_github_labels` is the most recent
  addition. See [current plan](07-plans/current.md).
- There is **no test suite yet** — `bun test` matches zero files. See
  [testing](06-workflows/testing.md).
