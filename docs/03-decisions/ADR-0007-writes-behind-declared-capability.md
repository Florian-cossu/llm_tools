---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-09-03
last_updated: 2026-09-04
summary: Supersedes ADR-0003 — mutating tools are allowed, but every tool declares an effect class, reads stay the default, irreversible tools wait for the permission layer.
read_when:
  - adding a tool that creates, edits, closes or deletes
  - wondering why a tool declares an effect class
  - reasoning about what an LLM can do with these tools
  - designing the permission layer
code_refs:
  - tools/github/src/toolbox/tools/create_github_label.ts
  - tools/github/src/toolbox/tools/update_github_label.ts
  - tools/github/src/toolbox/tools/delete_github_label.ts
  - tools/shared/src/tool_effect.ts
  - tools/github/src/toolbox/index.ts
  - tools/github/src/index.ts
tags:
  - adr
  - security
  - writes
  - permissions
---

# ADR-0007: Writes behind a declared capability

Supersedes [ADR-0003](ADR-0003-read-only-by-default.md).

## Context

[ADR-0003](ADR-0003-read-only-by-default.md) removed the write capability
entirely: *no registered tool calls a mutating endpoint*. That was the right
call for what this repo then was — a reader that answered questions about
GitHub issues. Removing a capability is the only control that cannot be
misconfigured, and it cost nothing that the repo wanted to do.

What changed is the target, not the threat model. These servers are becoming
the tool layer of a **fully custom harness**, not a read-only companion to
someone else's client. A harness that can only read is a harness that hands
every action back to the user: labelling an issue, closing what is done,
commenting a summary, and eventually deleting. Those actions are the point of
building it. `create_github_label` is the first of them and forced the
question; `update_github_label` is the second, and was the first to be reviewed
against the rules below rather than to produce them.

Everything ADR-0003 said about the caller still holds, and none of it is
withdrawn:

- The model chooses its own calls, from a prompt that includes text it does not
  control — an issue body is attacker-writable, and reaches the model verbatim.
- Validation cannot help. A well-formed call to `issues.update` is exactly what
  a confused or injected model emits.
- A small local model is more susceptible than a large one, and is the assumed
  consumer ([agent contract](../04-contracts/agent-contract.md)).

So the decision is not *whether the risk is real* — it is — but **what stands
in for removal now that removal is no longer affordable**. Two things are
available. First, the split ADR-0003 never made: read versus write is the
coarse cut, but the one that decides how much protection an action needs is
**reversible versus not**. Creating a label is a mistake someone deletes in ten
seconds; deleting one loses which issues carried it, and no API restores that.
Second, a gate. ADR-0003's own Alternatives section predicted its shape — an
`.env` opt-in composing with startup-time registration — and the real answer is
a **user-editable permission layer**, per tool, consulted before execution, and
stored where a user can change it without editing code.

## Decision

**Mutating tools are allowed.** The ADR-0003 guarantee — *no registered tool
calls a mutating endpoint* — no longer holds and must not be stated anywhere as
if it did.

In its place, six rules:

| # | Rule |
| --- | --- |
| **D1** | **Every tool declares an effect class**: `read`, `write` or `destructive`. It is a field on the registration, not a comment — the permission layer, the description surface and any review tooling all read the same declaration. |
| **D2** | **`read` is the default and stays honest.** A tool that declares nothing is a read, and a read tool calling a mutating endpoint is a defect, not a shortcut. Everything ADR-0003 required of a read tool still applies to it. |
| **D3** | **`destructive` is not registered yet.** Irreversible removal — deleting a label, a comment, a branch — waits for the permission layer. `write` that creates or adds is allowed now, because the compensating action exists and a user can take it. |
| **D4** | **A write tool is gated at registration**, not inside the handler. When its gate is off the tool is never registered, so the model never sees a capability the user has not enabled — this is what composes with the [execution lifecycle](../02-architecture/components/execution-lifecycle.md), where the tool list is fixed at initialisation. |
| **D5** | **A write tool declares itself to the model in its first sentence**, requires confirmation before the call, is idempotent-or-fails rather than silently double-applying, and returns what was written **read back from the API** rather than an echo of the input. |
| **D6** | **A write tool is documented as a write** in its server README and in the root tool table, and its effect class appears next to its name wherever tools are listed. A reader must be able to see what the server can change without opening a source file. |

D1 and D4 are the load-bearing pair. The declaration makes the capability
**machine-readable**, and the gate makes it **absent by default** — which is
the only property of ADR-0003 worth carrying forward.

### The permission layer

The gate's target form, and where this is heading:

- A **SQLite database**, local to the machine, holding one row per tool with the
  effect classes and the decision — allow, deny, or ask.
- **User-editable** without touching code, because the person running the
  harness is the one who knows which repository they are willing to let a model
  change.
- **Consulted before execution**, so a decision changes behaviour without a
  server restart — unlike registration, which is frozen at startup
  ([execution lifecycle](../02-architecture/components/execution-lifecycle.md)).
- Defaulting to **deny for anything not listed**, so a newly added write tool
  is inert until someone says otherwise.

That layer does **not exist yet**. It gets its own ADR when it is built, and
this one is written so that it can arrive without another supersession: D1 gives
it the declaration to read, D4 gives it the place to intervene.

> [!warning] What is actually implemented today
> **D1 through D6 are in code.** Every tool exports `TOOL_EFFECT`;
> `registrationRefusal` in `@llm-tools/shared` refuses `destructive` outright
> and refuses `write` unless `GITHUB_ALLOW_WRITES` is set; the github server's
> `index.ts` applies it before registering anything and logs each refusal to
> stderr; `buildServerInstructions` is built from what the gate allowed, so it
> cannot promise read-only while a write tool is registered.
>
> **The permission layer described above is not built.** An `.env` boolean is
> the whole gate today: it is per server, not per tool, it is read once at
> startup, and it says nothing about *which* repository the model may change —
> the token decides that. Nothing consults a stored decision before execution.
>
> **Its storage now exists, and only its storage.** `data/harness.db` holds a
> `github_mcp` table with one row per tool, carrying the allow/deny/**ask**
> decision described above, defaulting to `deny` and constrained to that closed
> set ([data store](../02-architecture/components/data-store.md)). **No code
> reads it**, and it does not carry the effect class. A seeded table is not a
> gate.
>
> **D3 is currently violated in code.** `delete_github_label` declares `write`
> while calling `issues.deleteLabel`, so the gate registers it. Treat this box
> as the state of the repo: see
> [current plan](../07-plans/current.md).

## Consequences

**Gained**

- The harness can act, not just report. The workflows ADR-0003 listed as its
  own cost — closing a stale issue, commenting from a summary, setting a
  milestone — become reachable.
- The read/write boundary becomes **visible per tool** instead of being a
  repo-wide claim. A reader asking "what can this change?" gets an answer from
  the tool list rather than from an ADR.
- One mechanism covers every future integration and every effect class,
  including ones GitHub does not have.
- Reviewing a tool stays cheap, and the question barely changes: *which
  endpoint, and does the declared class match it?*

**Cost**

- **The pleasant property is gone.** ADR-0003 bought "tools can be called
  without confirming", and that is what paid for the whole read-only rule.
  Promise A1 in the [agent contract](../04-contracts/agent-contract.md) is now
  false as written and must be rewritten per class, not deleted — reads still
  need it, or the model asks permission for every listing.
- **The commented-out read-only paragraph in `server_instructions.ts` must not
  be reinstated as written.** Re-enabling it now tells the model that tools it
  can see are harmless when one of them is not. It becomes conditional on what
  was actually registered.
- Prompt injection now has a reachable action. The blast radius is bounded by
  D3 and by token scope, not removed.
- Idempotency, partial writes and retry semantics are now the repo's problem.
  Every read tool was retry-safe for free; a write is not.
- The guarantee is weaker in kind: ADR-0003 was enforceable by grep, this is
  enforceable by a gate that has to work. **Nothing in the type system yet
  stops a tool declaring `read` and calling `createLabel`**, and there is still
  no test suite to catch it — see [testing](../06-workflows/testing.md).

**Not covered**

- Token scope. A user who grants write to a token and enables nothing still has
  a write-capable credential on disk; the gate covers this server's tools, as
  ADR-0003's did.
- Other clients using the same `.env`. Unchanged, and still out of scope.
- Audit. Nothing records what was written. Worth having once the permission
  layer has a database to put it in.

## Alternatives

**Keep ADR-0003 and put writes in a second server.** Rejected: the model sees
one flat tool list ([ADR-0004](ADR-0004-server-per-integration.md)), so
splitting the process changes what a *reader* sees and nothing about what the
model can call. It buys separate credentials, which the gate gives anyway.

**Writes behind client confirmation only.** Rejected, for ADR-0003's reason
unchanged: confirmation quality depends entirely on the client, and a user who
confirms by reflex gets no protection. D5 requires the model to ask, but that
is a prompt-surface courtesy on top of the gate — never the gate itself.

**Ship the permission layer before the first write tool.** The most defensible
sequencing, and rejected on cost: it blocks every write behind a database that
does not exist. D4 lets the small version — a flag consulted at registration —
stand in, with the same absent-by-default property and none of the schema work.

**Read-only token as the primary control.** Rejected again, and for the same
reason: it pushes the guarantee onto every user's setup and makes it
unverifiable from the repo. Still recommended as defence in depth.

**Effect classes as free-form strings, or a single `write: boolean`.** Rejected
both ways. A boolean cannot express D3 — the whole point is that creating and
deleting are not the same risk — and a free-form string cannot be checked
against a closed set, which is the same argument T8 makes about
`z.enum` in the [tool contract](../04-contracts/tool-contract.md#input-schema).
