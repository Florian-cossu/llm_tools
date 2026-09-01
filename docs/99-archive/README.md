---
type: archive
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Superseded documentation, kept for history. Empty.
read_when:
  - tracing why something used to be documented differently
tags:
  - index
  - archive
---

# 99-archive

Documentation that no longer describes the system, kept so its history stays
recoverable.

**Currently empty.**

> [!warning] Not authoritative
> Never cite a note here as current — see the
> [source-of-truth order](../00-index.md#source-of-truth).

## Archiving a note

1. Move it here, preserving its filename.
2. Set `status: superseded` and refresh `last_reviewed`.
3. Add a line at the top naming what replaced it, with a link.
4. Fix every inbound link — a dangling link in an active note is a bug.

**ADRs are never archived.** A reversed decision gets a new ADR and the old one
becomes `status: superseded` in place, so the numbering stays stable
([decisions](../03-decisions/README.md#format)).

Superseded *plans* go to [07-plans/archive](../07-plans/archive/README.md) instead.
