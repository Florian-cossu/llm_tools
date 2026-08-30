---
type: harness
status: draft
scope: repo
last_reviewed: 2026-08-30
summary: What a stdio MCP server can and cannot observe about itself, and the stderr discipline that follows.
read_when:
  - adding logging to a server
  - trying to see what a server is doing
tags:
  - harness
  - logging
  - stderr
---

# Observability

## The constraint that defines everything

`stdout` is the JSON-RPC wire. **All diagnostics go to `stderr`.** A single
stray `console.log` corrupts the transport and the client drops the server —
[failure modes §2](failure-modes.md#2-protocol--the-transport-breaks).

```ts
console.log("…")    // ✗ writes to stdout — breaks the protocol
console.error("…")  // ✓ stderr
process.stderr.write("…\n")  // ✓ explicit
```

`console.warn`, `console.error` and `console.info` go to `stderr` in Bun and
Node; `console.log` and `console.debug` do not. The safe habit is
`process.stderr.write`, which cannot be got wrong.

The scripts follow the same discipline for the same reason — `setup-tools.mjs`
logs to `stderr` so `--json-only` can be piped.

## Current state

> [!note] `status: draft`
> There is **no logging framework, no log levels, and almost no logging**. What
> exists is the `stderr` discipline and the error messages themselves. Servers
> currently emit nothing on a successful call.

Observable today:

| Signal | Where |
| --- | --- |
| Startup crashes | The client's MCP log |
| Anything on `stderr` | The client's MCP log |
| Tool call arguments and results | MCP Inspector |
| Error messages | Delivered to the model, visible in the chat |
| Rate-limit headers | Held by Octokit, **not surfaced** |

The client's log is the only place a startup failure appears, since the
transport is not yet connected — see
[execution lifecycle](../02-architecture/components/execution-lifecycle.md#failure-at-each-phase).

## Watching a server directly

The MCP Inspector shows the full request/response cycle and is the right tool
for anything call-related:

```bash
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

To see `stderr` alone, run the server and type at it — it waits on stdio:

```bash
bun run start:github 2>&1 1>/dev/null
```

More: [local development](../06-workflows/local-development.md) ·
[debugging](../06-workflows/debugging.md).

## If logging is added

- `stderr` only, always.
- **Never a credential**, and never a full API payload — it may contain issue
  content ([security and secrets](../04-contracts/security-and-secrets.md)).
- Prefix with the server name; a client multiplexes several servers into one log.
- Off, or minimal, by default. A chatty server makes the client's log useless
  for the crash you actually need to find.
- Worth surfacing first: the rate-limit headers Octokit already receives, since
  the search budget is the binding constraint
  ([github API](../04-contracts/github-api.md#rate-limits)).
