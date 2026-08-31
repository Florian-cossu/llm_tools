---
type: index
status: active
scope: repo
last_reviewed: 2026-08-31
summary: Index of architectural decision records, plus when and how to write a new one.
read_when:
  - proposing a cross-cutting change
  - asking why the architecture is the way it is
  - about to contradict something in 02-architecture
tags:
  - index
  - decisions
  - adr
---

# Decisions

Architectural Decision Records. [02-architecture](../02-architecture/README.md) says
*what* the system is; these say **why**, and what was given up.

An ADR is the highest-authority prose in this vault: an architecture note that
contradicts an accepted ADR is a bug in the note.

## Index

| ADR                                          | Decision                                                                                  | Status   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| [0001](ADR-0001-local-stdio-transport.md)    | Local, stdio-based transport — no hosting, no HTTP                                        | Accepted |
| [0002](ADR-0002-bun-workspaces.md)           | Bun workspaces, TypeScript run directly, no build step                                    | Accepted |
| [0003](ADR-0003-read-only-by-default.md)     | Tools are read-only unless explicitly reviewed                                            | Accepted |
| [0004](ADR-0004-server-per-integration.md)   | One MCP server per integration, not one gateway                                           | Accepted |
| [0005](ADR-0005-root-dependencies.md)        | Dependencies declared once in the root `package.json`                                     | Accepted |
| [0006](ADR-0006-frugal-output-by-default.md) | Tools and API responses need to be mapped to the strict minimum number of reusable values | Accepted |

## When to write one

Write an ADR when a change:

- crosses a [non-goal](../01-context/goals-and-nongoals.md#non-goals);
- alters a [contract](../04-contracts/README.md);
- affects every server rather than one;
- adds a capability class that does not exist yet — **any write tool
  qualifies**;
- introduces a runtime, transport or dependency with repo-wide reach.

Do **not** write one for adding a tool, adding a server that follows the
existing pattern, or documentation changes.

## Format

`ADR-NNNN-short-title.md`, sequential, **never renumbered and never deleted**.
A reversed decision gets a new ADR; the old one becomes
`status: superseded` and names its replacement.

```markdown
---
type: decision
status: accepted        # proposed | accepted | superseded | deprecated
scope: repo
last_reviewed: 2026-08-30
summary: One line.
tags: [adr]
---

# ADR-000N: Title

## Context      — the forces, before the decision
## Decision     — what was chosen, in the active voice
## Consequences — what this buys, and what it costs
## Alternatives — what was rejected, and why
```

`status` here uses the ADR vocabulary (`proposed`/`accepted`) alongside the
vault's own values — see [conventions](../00-conventions.md#status).

The **Consequences** section is the part that earns its keep. An ADR listing
only benefits has not been thought through.
