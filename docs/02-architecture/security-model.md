---
type: architecture
status: active
scope: repo
last_reviewed: 2026-08-30
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
| Model triggers a destructive action | **Tools are read-only.** The capability does not exist to be misused | [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) |
| Token committed to git | `.env` git-ignored; only `.env.example` tracked | [`.gitignore`](../../.gitignore) |
| Token leaked to the transport | Nothing writes secrets to `stdout`; `dotenv` runs `quiet` | [`index.ts`](../../tools/github/src/index.ts) |
| Token leaked into docs/fixtures | Fixtures are synthetic; no captured production responses | [conventions](../00-conventions.md#writing-rules) |
| Over-broad credentials | Token scope is the user's to minimise — *Issues: read* suffices | [`.env.example`](../../tools/github/.env.example) |
| Blast radius across integrations | One server, one integration, one credential set | [ADR-0004](../03-decisions/ADR-0004-server-per-integration.md) |
| Unreviewed server in the client | Registration is explicit, per server, via `--write` or by hand | [setup and registration](components/setup-and-registration.md) |

## The read-only guarantee, precisely

It is a guarantee about **registered capability**, not about the token. The
token in `.env` may well carry write scope — GitHub's classic `repo` scope does.
What holds is that no registered tool calls a mutating endpoint. Every current
tool calls `octokit.rest.issues.get`, `getMilestone`, or
`search.issuesAndPullRequests`.

Two consequences:

- Adding a tool that writes **breaks a documented guarantee** and requires an
  ADR superseding [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md),
  not just a code review.
- A reader minimising risk should reduce the **token scope**, since that is the
  only control the repo cannot enforce for them.

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
  text that reaches the model. Read-only tooling bounds the damage: there is no
  registered action for an injected instruction to trigger.
- **Dependency supply chain.** `octokit`, `zod`, `dotenv` and the MCP SDK run
  with the token in-process. Pinned via [`bun.lock`](../../bun.lock).
