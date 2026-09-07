---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-09-07
last_updated: 2026-09-07
summary: Drops GITHUB_ALLOW_WRITES entirely — the permission table's per-tool state is now the only registration gate, for every effect class.
read_when:
  - wondering why there is no write-enabling env var anymore
  - adding a new server and deciding whether it needs its own write flag
  - reasoning about what actually stops a mutating tool from registering
code_refs:
  - tools/github/src/index.ts
  - tools/shared/src/tool_effect.ts
  - data/access.ts
  - tools/github/.env.example
tags:
  - adr
  - security
  - permissions
  - writes
  - configuration
---

# ADR-0009: The permission table is the only write gate — `GITHUB_ALLOW_WRITES` is gone

Revises [ADR-0007](ADR-0007-writes-behind-declared-capability.md) D4 (as already
narrowed by [ADR-0008](ADR-0008-permission-table-gates-registration.md)) and
retires the `.env` mechanism D4 described. Everything else in ADR-0007 —
effect classes, `read` as the honest default, gating at registration rather
than in a handler — is unchanged.

## Context

ADR-0008 made `destructive` registration depend on the permission table's
`state` rather than a blanket refusal, on the grounds that a per-tool,
user-editable decision is a more specific consent than a repo-wide `.env`
boolean. That reasoning did not actually stop at `destructive` — it applies
identically to `write`. Once every mutating tool has a permission-table row
that defaults to `deny`, `GITHUB_ALLOW_WRITES` was deciding nothing that row
did not already decide on its own; it was a second coarse cut in front of a
finer one, not a check with independent content.

Concretely, before this ADR a tool needed to satisfy two conditions to
register: `registrationRefusal(effect, allowWrites)` (effect class **and** the
env flag) and `isToolAllowed(slug, server)` (the permission table). The first
condition contributed nothing the second did not already cover, since:

- Registering **any** mutating tool required `GITHUB_ALLOW_WRITES=true`.
- With that set, whether a *specific* mutating tool actually registered was
  entirely down to its row's `state` — which is exactly what the permission
  table exists for.

There was also a practical cost, and it's what prompted this ADR: the stated
goal for this repo's configuration surface is that a server's `.env` should
hold **tokens and defaults**, not feature flags — decisions like "is this tool
allowed" belong in the one place a human edits them without touching a file
that also holds credentials, and without a restart-inducing edit for something
the control panel already exists to do.

## Decision

**`GITHUB_ALLOW_WRITES` is removed** — from `.env.example`, from `ServerConfig`,
and from the server's startup. **`registrationRefusal` and `booleanFromEnv` are
deleted** from `@llm-tools/shared`: both existed only to compute and consult
that flag, and had no other caller.

`tools/github/src/index.ts` now runs a **single filter** over
`TOOL_REGISTRATIONS`: `isToolAllowed(registration.name, "github")`. A tool of
any effect class — `read`, `write`, `destructive` — registers if and only if
its permission-table row is `allow`. There is no longer a separate, coarser
cut in front of it.

`TOOL_EFFECT` is not weakened by this. It still:

- decides what `describeMutation` puts at the top of a tool's description
  (D1, D5);
- is what `docs/06-workflows/testing.md`'s grep check verifies against the
  actual Octokit call (T4b/T4c);
- is what the seeded `tool_effect` column in `permissions` is meant to mirror.

It simply no longer participates in the registration gate itself — that gate
reads `state` and nothing else.

One consequence for **new tools**: a freshly-added tool, of any effect class
including `read`, registers only once a migration seeds its `permissions` row.
This was already true for every tool after ADR-0008 wired `isToolAllowed` into
the same filter for all effect classes — this ADR does not introduce it, it
just removes the env flag that used to sit in front of that behaviour for
`write`.

## Consequences

**Gained**

- One gate, one place to look, for every effect class. "Why isn't this tool
  registered?" now has exactly one answer: check its permission-table row.
- `.env` holds only what ADR-0009's own framing wants it to hold: a token and
  optional defaults. No feature flag lives next to a credential.
- Toggling write capability is a control-panel edit, same UI as everything
  else permission-related, rather than a separate file and a separate mental
  model.
- Two functions (`registrationRefusal`, `booleanFromEnv`) and a `ServerConfig`
  field are deleted rather than kept around unused.

**Cost**

- **The coarse, independent-of-the-database kill switch is gone.** Previously,
  setting `GITHUB_ALLOW_WRITES` off in `.env` guaranteed no mutating tool could
  register, regardless of what the permission table said — a second control
  that did not depend on the database being correct. That is no longer true:
  if every row in `permissions` were somehow `allow`, every tool registers,
  full stop. The permission table is now a single point of failure for this
  guarantee where there used to be two independent ones.
- A forgotten permission-table row now silently excludes **any** new tool,
  including a harmless `read` one, not just a mutating one — see the
  consequence noted in the Decision section. This existed since ADR-0008 but
  is worth restating because it is easy to assume `read` tools are exempt.
- The control panel's write path is now the **only** thing standing between a
  `destructive` tool and the model, for both effect classes it used to share
  a flag with. ADR-0008 already flagged this as unreviewed; it is more true
  now than it was then.

**Not covered**

- Reviewing `control_panel`'s write path as a security boundary. Still open,
  still tracked in [current plan](../07-plans/current.md).
- `ask`, live reload, and audit — unchanged by this ADR, same gaps ADR-0008
  left open.

## Alternatives

**Keep `GITHUB_ALLOW_WRITES` as a defense-in-depth second gate.** Rejected:
its only remaining content, once the permission table gates every effect
class, is "trust the operator to keep it and the database consistent" — which
is exactly as fragile as trusting the database alone, and now the operator has
two places to update instead of one. A genuinely independent second control
would need to be something the permission table itself cannot express (e.g. a
kill switch not stored in the same file the control panel edits) — worth
having if this repo later grows a documented incident where the database gate
alone failed, not preemptively.

**Give every future server its own version of the flag, deleted only for
github.** Rejected: the reasoning here is server-agnostic (any server with a
permission table gains nothing from a redundant flag), and a second server
copying the old pattern would just reintroduce the thing this ADR removes.

**Leave `registrationRefusal`/`booleanFromEnv` in `@llm-tools/shared` in case a
future server wants them.** Rejected per the repo's own convention against
speculative code: nothing calls them, and a future server that wants a coarse
env-based cut can write one against its own needs when it exists, rather than
this repo carrying dead exports against a hypothetical.
