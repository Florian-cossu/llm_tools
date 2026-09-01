---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: MCP servers run as local child processes over stdio - no hosting, no HTTP transport, no auth layer.
read_when:
  - proposing a network transport, a hosted deployment or multi-user access
  - reasoning about where credentials live
code_refs:
  - tools/github/src/index.ts
tags:
  - adr
  - transport
  - security
---

# ADR-0001: Local stdio transport

## Context

MCP servers can be reached over stdio (the client spawns a child process) or
over a network transport such as HTTP/SSE (the client connects to a listener).

The setting here is personal tooling on one machine, driven by a local model in
LM Studio. The credentials involved are personal access tokens with real access
to real repositories.

## Decision

Every server in this repository is a **local child process communicating over
stdio**. No listener, no port, no hosted deployment, no auth layer.

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

Credentials are read from a git-ignored `.env` beside the server.

## Consequences

**Gained**

- The token never leaves the machine and never crosses a network the user does
  not control. The trust boundary is drawn once, at the external API — see
  [security model](../02-architecture/security-model.md).
- No auth layer to write, because there is nothing to authenticate: the only
  process that can reach the server is the one that spawned it.
- Setup is a path in a JSON file. No TLS, no ports, no deployment.

**Cost**

- **`stdout` is the protocol.** Anything written there corrupts the wire, which
  is why `dotenv` is configured `quiet: true` and all diagnostics go to
  `stderr`. This constraint propagates into every server and every script —
  [constraints](../01-context/constraints.md#transport).
- **The server does not control its lifetime.** No lifecycle hooks; config is
  fixed at startup and `.env` edits need a restart —
  [execution lifecycle](../02-architecture/components/execution-lifecycle.md).
- One process per client. Two clients means two processes, sharing the token's
  rate-limit budget but nothing else.
- No remote access, no sharing a server between machines or users.
- Registration is manual per machine, which is what
  [`setup-tools.mjs`](../02-architecture/components/setup-and-registration.md)
  automates.

## Alternatives

**HTTP/SSE transport.** Would allow sharing a server between clients or
machines. Rejected: it turns a zero-config personal tool into something needing
auth, TLS and a place to run, and it moves the token off the machine that owns
it. The sharing was never wanted.

**A hosted gateway fronting several integrations.** Rejected on the same
grounds, plus it concentrates every credential in one process — see
[ADR-0004](ADR-0004-server-per-integration.md).

**Reading credentials from the client's config** (`env` in `mcp.json`) instead
of `.env`. Partially available and deliberately unused for secrets: `mcp.json`
is a shared, backed-up, non-git-ignored file. `tool.json`'s `env` field exists
for non-secret values only.
