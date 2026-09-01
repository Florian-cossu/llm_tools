---
type: context
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: The fixed limits every design here must respect - transport, context window, rate limits, tooling.
read_when:
  - designing a new tool or server
  - a design seems to work but violates something non-negotiable
code_refs:
  - tools/github/src/index.ts
  - tools/github/src/metadata.ts
tags:
  - context
  - constraints
---

# Constraints

Non-negotiable limits. Each one has bitten, or would.

## Transport

- **`stdout` is the JSON-RPC channel.** Anything else written there corrupts
  the protocol and the client drops the server. All diagnostics go to `stderr`.
  This is why `dotenv` is configured with `quiet: true` in
  [`index.ts`](../../tools/github/src/index.ts) — its startup banner would
  otherwise land on `stdout`.
  See [observability](../05-harness/observability.md).
- **One process per server, launched by the client.** The server does not
  choose when it starts, and has no lifecycle hooks beyond process exit.
  See [execution lifecycle](../02-architecture/components/execution-lifecycle.md).
- **Configuration is read once, at startup.** Editing `.env` requires a restart
  from the client.

## The model

- **Small context window.** Full API payloads do not fit. Every response is
  mapped to a compact shape before it reaches the model.
  See [data schemas](../04-contracts/data-schemas.md).
- **The tool description is read before the schema.** A default stated only in
  the schema will not stop the model asking the user for it.
  See [agent contract](../04-contracts/agent-contract.md).
- **Tool calling must be supported by the loaded model.** A model without
  function-calling silently ignores every registered tool — there is no error
  to catch. See [debugging](../06-workflows/debugging.md).
- **No pagination state.** The model is given `limit` and a truncation signal,
  not a cursor.

## External APIs

- **GitHub search is rate-limited to ~30 requests/minute**, separately from the
  5 000/hour core limit. One targeted search beats several broad ones — and the
  tool description says so, because the model is the one choosing.
- **Unauthenticated requests are capped at 60/hour** and see public repos only.
- **`state:all` is not a GitHub qualifier.** Both states means omitting the
  qualifier entirely, not passing `all`.
  See [github API](../04-contracts/github-api.md).

## Tooling

- **Bun 1.3+**, no build step. TypeScript runs directly.
  See [ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md).
- **The orchestration scripts are dependency-free `.mjs` on Node.** They must
  run before `bun install` has ever happened.
  See [setup and registration](../02-architecture/components/setup-and-registration.md).
- **LM Studio 0.3.17+** for MCP support.

## Security

- **`.env` is never committed.** Only `.env.example` is tracked.
- **Read-only unless explicitly reviewed.**
  See [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) and
  [security and secrets](../04-contracts/security-and-secrets.md).
