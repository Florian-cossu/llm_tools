---
type: index
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Index of the architecture notes - the descriptive map of how the system fits together.
tags:
  - index
  - architecture
---

# 02-architecture

*What* the system is. The *why* lives in [03-decisions](../03-decisions/README.md),
and an architecture note contradicting an accepted ADR is a bug in the note.

| Note | Answers |
| --- | --- |
| [System overview](system-overview.md) | How do the pieces fit? **Start here** |
| [Data flows](data-flows.md) | What happens between a prompt and a JSON response? |
| [Security model](security-model.md) | Where are the trust boundaries? |
| [components/](components/README.md) | What does each individual piece do? |

Authoritative, but **code wins** — see the
[source-of-truth order](../00-index.md#source-of-truth).
