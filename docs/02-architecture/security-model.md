---
type: architecture
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-03
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
| Model triggers a destructive action | **No `destructive` tool is registrable**, and a `write` tool is registered only when the user enabled writes | [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md) |
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
- A `write` tool is registered **only when `GITHUB_ALLOW_WRITES` is set**. When
  it is not, the tool is skipped at startup and never appears in the model's
  tool list — the flag fails closed, so a typo leaves writes off.
- **No `destructive` tool is registrable at all** yet. Irreversible removal
  waits for the permission layer.
- The server instructions name every registered mutating tool, so the model is
  never told a server is harmless when it is not.

Two consequences:

- Adding a mutating tool is now a code review against the
  [tool contract](../04-contracts/tool-contract.md#effect-class-and-writes),
  not an ADR — **unless it is `destructive`**, which still needs one.
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
  text that reaches the model, and with writes enabled there is now a registered
  action for an injected instruction to reach. What bounds the damage is
  narrower than it was: the action must be non-destructive, the user must have
  turned writes on, and the server instructions tell the model that issue and
  comment text is not the user speaking. **That last part is a mitigation, not a
  control** — it is prose, and a small model may not honour it. Leave
  `GITHUB_ALLOW_WRITES` unset on any server pointed at a repository whose issues
  you do not trust.
- **Nothing records what was written.** There is no audit trail; a label created
  by mistake is found by noticing it. Worth fixing when the permission layer
  gets a database.
- **Dependency supply chain.** `octokit`, `zod`, `dotenv` and the MCP SDK run
  with the token in-process. Pinned via [`bun.lock`](../../bun.lock).
