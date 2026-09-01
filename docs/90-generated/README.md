---
type: index
status: planned
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Reserved for machine-written documentation. Empty - nothing generates docs today.
read_when:
  - adding documentation generation
  - you found a file here and wonder whether to edit it
tags:
  - index
  - generated
---

# 90-generated

Reserved for documentation produced by a script rather than by hand.

**Currently empty. Nothing in this repository generates documentation.**

> [!warning] Never edit by hand
> [`CLAUDE.md`](../../CLAUDE.md) forbids modifying generated files manually. A
> hand-edit here is overwritten on the next run, and the fix belongs in the
> generator instead.

If generation is ever added, the plausible candidates are the things that
already exist twice and can drift:

| Candidate | Currently duplicated in |
| --- | --- |
| The tool catalogue (names, versions, descriptions) | Root README, `tools/README.md`, [github server](../02-architecture/components/github-server.md) |
| Input schemas, rendered from zod | Each server's README parameter tables |
| The registered tool list, from `TOOL_INSTANCES` | Prose in several notes |

Anything landing here must carry `type: generated`, a `source:` field naming the
script, and a header saying it is generated — see
[conventions](../00-conventions.md).
