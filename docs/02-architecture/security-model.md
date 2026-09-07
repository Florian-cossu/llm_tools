---
type: architecture
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-07
summary: The trust boundaries of a local stdio MCP server, what protects credentials, and the residual risks.
read_when:
  - handling tokens, credentials or scopes
  - proposing a write capability or a new external call
  - reviewing what a tool is allowed to reach
code_refs:
  - tools/github/src/index.ts
  - tools/github/.env.example
  - .gitignore
tags:
  - architecture
  - security
  - read-only
---

# Security model

Operational rules live in
[security and secrets](../04-contracts/security-and-secrets.md). This note is
the *model*: who is trusted, where the boundaries are, and what remains exposed.

## Trust boundaries

```
┌── your machine ─────────────────────────────────────────┐
│                                                          │
│  ┌── MCP client ────────┐                                │
│  │  model (untrusted    │                                │
│  │  output, chooses     │                                │
│  │  which tools to call)│                                │
│  └──────────┬───────────┘                                │
│             │ stdio — no network, no auth needed          │
│  ┌──────────▼───────────┐      ┌─────────────┐           │
│  │  MCP server process  │◄─────┤  .env       │           │
│  │  holds the token     │      │  git-ignored│           │
│  └──────────┬───────────┘      └─────────────┘           │
└─────────────┼────────────────────────────────────────────┘
              │ HTTPS, authenticated
     ┌────────▼────────┐
     │  GitHub REST    │  ← the only trust boundary crossed
     └─────────────────┘
```

Two things follow from this picture:

1. **There is no network listener.** The server is a child process reachable
   only through the pipe its parent opened. No port, no auth layer, no
   multi-tenancy — see [ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md).
2. **The model is inside the boundary, and is not trusted.** It chooses which
   tools to call and with what arguments. That is precisely why capability, not
   validation, is the control — see below.

## Controls

| Risk | Control | Where |
| --- | --- | --- |
| Model triggers a destructive action | A `destructive` tool registers only when the user enabled writes **and** explicitly set its permission-table row to `allow`; it seeds `deny` | [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md), [ADR-0008](../03-decisions/ADR-0008-permission-table-gates-registration.md) |
| Token committed to git | `.env` git-ignored; only `.env.example` tracked | [`.gitignore`](../../.gitignore) |
| Token leaked to the transport | Nothing writes secrets to `stdout`; `dotenv` runs `quiet` | [`index.ts`](../../tools/github/src/index.ts) |
| Token leaked into docs/fixtures | Fixtures are synthetic; no captured production responses | [conventions](../00-conventions.md#writing-rules) |
| Over-broad credentials | Token scope is the user's to minimise — *Issues: read* suffices | [`.env.example`](../../tools/github/.env.example) |
| Blast radius across integrations | One server, one integration, one credential set | [ADR-0004](../03-decisions/ADR-0004-server-per-integration.md) |
| Unreviewed server in the client | Registration is explicit, per server, via `--write` or by hand | [setup and registration](components/setup-and-registration.md) |

## The capability guarantee, precisely

**This is no longer a read-only server.** `create_github_label` calls
`issues.createLabel` and `update_github_label` calls `issues.updateLabel`, and [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)
replaced the blanket ban with a narrower guarantee — still about **registered
capability**, not about the token:

- Every tool declares an effect class, and a `read` declaration is binding: it
  may not call a mutating endpoint.
- **A `write` or `destructive` tool is registered only when its permission-table
  row is `allow`** ([ADR-0008](../03-decisions/ADR-0008-permission-table-gates-registration.md),
  [ADR-0009](../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).
  Every mutating row seeds `deny`, so a tool stays unreachable until a human
  changes that row in the control panel — deliberately, per tool, rather than
  by a repo-wide flag. There is no separate env var anymore: a typo or an
  unset `.env` used to fail closed for `write`, and now there is nothing left
  to unset — the table's default already is closed.
- The server instructions name every registered mutating tool, so the model is
  never told a server is harmless when it is not.

Two consequences:

- Adding a mutating tool is now a code review against the
  [tool contract](../04-contracts/tool-contract.md#effect-class-and-writes) —
  an ADR is only needed when the change itself crosses one of the triggers in
  [the decisions index](../03-decisions/README.md#when-to-write-one), which
  adding a `destructive` tool no longer does on its own now that ADR-0008
  covers the class.
- A reader minimising risk should reduce the **token scope**, since that is the
  only control the repo cannot enforce for them. It is also the only control
  that binds clients other than this one.

## Residual risks

Accepted, and worth naming:

- **A read-only tool still exfiltrates.** The model can read any issue the token
  can see and put it in a conversation. Scope the token to what the model should
  be allowed to read.
- **`.env` sits in plaintext** next to the server. It is protected by filesystem
  permissions only — appropriate for a single-user machine, and the reason
  [ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md) does not extend
  to shared hosts.
- **Prompt injection via issue content.** Issue bodies are attacker-controllable
  text that reaches the model, and a registered mutating tool is now a
  potential action for an injected instruction to reach. What bounds the
  damage: the action must be one whose permission-table row is `allow` — `deny`
  by default, a human decision per tool — and the server instructions tell the
  model that issue and comment text is not the user speaking. **That last part
  is a mitigation, not a control** — it is prose, and a small model may not
  honour it. Leave every mutating tool's permission-table row at `deny` on any
  server pointed at a repository whose issues you do not trust.
- **Nothing records what was written.** There is no audit trail; a label created
  by mistake is found by noticing it. Worth fixing when the permission layer
  gets a database.
- **Dependency supply chain.** `octokit`, `zod`, `dotenv` and the MCP SDK run
  with the token in-process. Pinned via [`bun.lock`](../../bun.lock).
