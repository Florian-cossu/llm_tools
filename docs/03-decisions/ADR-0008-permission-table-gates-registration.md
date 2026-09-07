---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-09-07
last_updated: 2026-09-07
summary: Revises ADR-0007 D3 — the permission table's per-tool state now gates registration, so a destructive tool is refused by default rather than always.
read_when:
  - wondering why a destructive tool can register at all
  - adding a tool that deletes, merges or otherwise cannot be undone
  - reasoning about what the permission table actually controls today
code_refs:
  - data/access.ts
  - tools/shared/src/tool_effect.ts
  - tools/github/src/index.ts
  - tools/github/src/toolbox/tools/delete_github_label.ts
tags:
  - adr
  - security
  - permissions
  - writes
---

# ADR-0008: The permission table gates registration; `destructive` is no longer blanket-refused

Revises [ADR-0007](ADR-0007-writes-behind-declared-capability.md) D3. Everything
else in ADR-0007 — D1, D2, D4, D5, D6, and the read/write/destructive
vocabulary itself — is unchanged and still in force.

## Context

ADR-0007 D3 refused any tool declaring `destructive` outright, whatever
`GITHUB_ALLOW_WRITES` said, because the only consent available at the time was
a single `.env` boolean — coarse, per-server, and not a defensible stand-in for
"the user agreed this specific irreversible action may run." The ADR named this
explicitly as a placeholder: "waits for the permission layer," and described
that layer's target shape — SQLite, one row per tool, an editable
allow/deny/ask decision, defaulting to deny.

That storage now exists. `data/harness.db`'s `permissions` table
([data store](../02-architecture/components/data-store.md)) carries exactly
that: one row per tool, `state` constrained to `allow`/`deny`/`ask`, defaulting
to `deny`, editable through the [control panel](../02-architecture/components/control-panel.md)
without touching code. `data/access.ts` exports `isToolAllowed(slug,
server_slug)`, and `tools/github/src/index.ts` now consults it as a second
registration filter, after the existing effect-class gate — a tool must pass
both to register. This is the missing half D3 was written to wait for.

With that in place, refusing `destructive` unconditionally is redundant with a
mechanism that already defaults to the same outcome (deny) but can be
overridden **per tool, deliberately, by the person running the harness** —
which is a more specific consent than the blanket refusal ever offered, not a
weaker one.

## Decision

**`registrationRefusal` no longer special-cases `destructive`.** It now treats
`write` and `destructive` identically at the coarse cut: both are `isMutating`,
both need `GITHUB_ALLOW_WRITES`. `destructive`'s distinguishing rule moves
entirely to the permission table:

- A `destructive` tool registers only when **both** hold: `GITHUB_ALLOW_WRITES`
  is set, and its `permissions` row has `state = 'allow'`.
- Its row seeds `deny` by default ([0004](../../data/migrations/0004_add_github_tools_permissions.sql)
  already seeds `delete_github_label` this way) — an unlisted or freshly-added
  destructive tool is inert until someone opens the control panel and changes
  it, same as ADR-0007 always intended.
- `ask` is not a third outcome yet. `isToolAllowed` treats anything other than
  `allow` — including `ask` and a missing row — as not allowed. Building a real
  confirmation flow is future work, not part of this ADR.
- The change to take effect still needs a **server restart**: the permission
  table is read once, at registration, exactly where `GITHUB_ALLOW_WRITES`
  already is ([execution lifecycle](../02-architecture/components/execution-lifecycle.md)).
  Live reload is a separate, larger change this ADR does not make.

`delete_github_label` declaring `TOOL_EFFECT = "destructive"` (rather than the
`write` it shipped with, per the [known defect](../07-plans/current.md)) is now
load-bearing: the effect-class gate no longer refuses it on its own, so the
declaration and the permission table's `deny` are what keep it out of the
model's hands today.

## Consequences

**Gained**

- D3's own reasoning is honored more precisely than the blanket refusal did:
  consent is now per tool and reversible by the user, rather than a single
  repo-wide bit nobody can turn on without editing code.
- The permission table stops being storage nobody reads. This is the first
  thing that makes it a gate rather than a seeded table with a UI on top.
- A future destructive tool (closing an issue, merging a PR) can ship gated by
  the same mechanism instead of needing another ADR to unblock its class.

**Cost**

- **The strongest guarantee ADR-0007 offered is gone.** "No destructive tool
  can be registered, full stop, regardless of configuration" is no longer true.
  It is replaced by "not registered unless a human explicitly flips a row,"
  which is weaker in kind, not just in degree — a control panel bug, a
  seed-data mistake, or someone flipping the wrong row now has a real action
  behind it, where before nothing did.
- The permission table's `state` is now security-relevant in a way it wasn't
  when nothing consulted it. `control_panel`'s write path
  (`control_panel/lib/db.ts`, the `PATCH`/`DELETE` route) has not been reviewed
  against that standard — it was built as an editor for inert seed data.
- Still no audit trail. Flipping `delete_github_label` to `allow` and back
  leaves no record of who did it or when.
- The two gates (effect class, permission table) are separately maintained and
  can drift, the same way `TOOL_EFFECT` and the seeded `tool_effect` column
  already drifted once ([data store](../02-architecture/components/data-store.md)).
  Nothing enforces they agree.

**Not covered**

- `ask` as a real outcome. It is accepted as input, constrained by the same
  `CHECK`, and stored — but has no effect distinct from `deny` yet.
- Live reload. A row changed in the control panel needs a restart to matter,
  same limitation `GITHUB_ALLOW_WRITES` always had.
- Reviewing the control panel's write path as a security boundary rather than
  a convenience UI.

## Alternatives

**Leave D3 as written and let the permission table govern `write` only.**
Rejected: it leaves the table half-pointless — the one class it was explicitly
built to eventually unblock stays unblockable regardless of what the table
says, so "the permission layer decides" would be true for everything except
the case ADR-0007 introduced the layer to handle.

**Add a third, `destructive`-specific gate on top of both existing ones (e.g.
require an extra env flag).** Rejected as redundant: the permission table
already defaults to deny per tool, which is a finer-grained version of the same
idea. A second flag would just be another coarse bit to keep in sync.

**Wait for `ask` and audit before allowing `destructive` at all.** The more
conservative option, and arguably the one ADR-0007 implied ("consulted before
execution" reads as the finished layer). Rejected for now on the same cost
basis ADR-0007 itself used for D4: the small version — deny-by-default, human
edits a row, restart required — has the same absent-by-default property and
ships today; `ask` and audit remain open work, not blockers, tracked in
[current plan](../07-plans/current.md).
