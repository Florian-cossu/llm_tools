---
type: decision
status: superseded
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-03
summary: "SUPERSEDED by ADR-0007: tools were read-only and no registered tool called a mutating endpoint. Kept for the threat model, which still holds."
read_when:
  - you want the threat model a write tool has to answer to
  - reading history; for the rule in force see ADR-0007
code_refs:
  - tools/github/src/toolbox/tools/
  - tools/github/src/server_instructions.ts
tags:
  - adr
  - security
  - read-only
---

# ADR-0003: Read-only by default

> [!warning] Superseded by [ADR-0007](ADR-0007-writes-behind-declared-capability.md)
> **The decision below is no longer in force.** Mutating tools are allowed;
> `create_github_label` and `update_github_label` are two. Do not cite "no registered tool calls a
> mutating endpoint" as a current guarantee.
>
> What survives is the **Context** section — the reasoning about an
> injection-prone model choosing its own calls is exactly why ADR-0007 declares
> effect classes and gates writes at registration rather than trusting
> validation. Read this for the threat model; read ADR-0007 for the rule.

## Context

The caller of these tools is a language model. It decides on its own which tool
to call and with what arguments, from a prompt that may include text it does not
control — an issue body, for instance. A local model, small and driven by tool
descriptions, is more prone to this than a large one.

The GitHub API offers write operations that are trivially reachable from the
same Octokit client the read tools already hold: closing issues, editing
bodies, deleting comments.

Validation cannot solve this. A well-formed call to
`octokit.rest.issues.update` is exactly what a confused model would emit.

## Decision

**No registered tool calls a mutating endpoint.** Every tool is a read.

Adding a write capability requires an ADR superseding this one — not merely a
code review — and the tool must be documented as a write in its server's README.

The guarantee is about **registered capability, not token scope**. The token in
`.env` may hold write permission; what holds is that no code path reaches a
mutating endpoint.

## Consequences

**Gained**

- The failure mode is removed rather than mitigated. A misfiring model, or an
  injected instruction in an issue body, has no destructive action available.
- Tools can be called without confirmation, which is what makes them pleasant.
  A commented-out paragraph in
  [`server_instructions.ts`](../../tools/github/src/server_instructions.ts)
  would have told the model exactly that — worth reinstating.
- Every call is idempotent and retry-safe: no partial writes, no compensations,
  no audit trail to keep.
- Reviewing a new tool is cheap: *which endpoint does it call?*

**Cost**

- Genuinely useful workflows are out of reach — closing a stale issue,
  commenting from a summary, setting a milestone.
- The repo cannot enforce it end-to-end. A user's token may grant write access
  and another client could use it; the guarantee covers this server's tools
  only.
- It is a convention, not a mechanism. Nothing in the type system stops a new
  tool calling `issues.update`. With no test suite, review is the only gate —
  see [testing](../06-workflows/testing.md).

**Not covered**

Read-only does not mean harmless. The model can surface anything the token can
read. Scoping the token is the user's control — see
[security model](../02-architecture/security-model.md#residual-risks).

## Alternatives

**Writes behind a confirmation prompt.** Rejected for now: confirmation quality
depends entirely on the client, and a user who confirms by reflex gets no
protection. Reconsider if a client offers a dependable, per-tool consent
mechanism.

**Writes behind an `.env` opt-in** (`GITHUB_ALLOW_WRITES=true`). Rejected as
premature — but this is the most likely shape of a future superseding ADR, since
it composes with [execution lifecycle](../02-architecture/components/execution-lifecycle.md):
the tool would simply not be registered when the flag is off, so the model would
never see a capability it must not use.

**Relying on a read-only token.** Rejected as the *primary* control: it pushes
the guarantee onto every user's setup and makes it unverifiable from the repo. A
fine defence in depth, and recommended.
