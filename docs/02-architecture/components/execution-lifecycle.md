---
type: component
status: active
scope: mcp
last_reviewed: 2026-08-30
last_updated: 2026-09-03
summary: The lifecycle of a server process - spawn, initialise, serve calls, die with the client - and what is fixed at each stage.
read_when:
  - a config change does not seem to take effect
  - reasoning about state, caching or restarts
  - debugging a server that exits immediately
code_refs:
  - tools/github/src/index.ts
tags:
  - component
  - lifecycle
  - mcp
---

# Execution lifecycle

A server does not control its own lifetime. The client spawns it, keeps it
alive, and kills it. There are no lifecycle hooks beyond process exit.

## Phases

```
① SPAWN        client reads mcp.json → spawns `bun run …/src/index.ts`
                 └─ cwd and env come from the client, not a shell
② INITIALISE   dotenv → ServerConfig → instructions → registerTool × n
                 └─ everything the model will see is FIXED here
③ HANDSHAKE    connect(StdioServerTransport)
                 └─ name, version, instructions, tool list → client
④ SERVE        one process, many tool calls, sequential over stdio
                 └─ no per-call setup; config is captured in closures
⑤ EXIT         client closes stdin / kills the process
                 └─ no cleanup hook; nothing to flush
```

## What is fixed at initialisation

This is the practical consequence of the whole design, and the source of the
most common confusion:

| Fixed at ② | Meaning |
| --- | --- |
| `.env` values | **Editing `.env` does nothing until restart** |
| `ServerConfig` | Read once, captured by every tool closure |
| Server instructions | Built from config; a newly-set default won't appear until restart |
| Tool descriptions | Composed with `describeConfiguredRepository(config…)` at registration |
| Input schemas | `optionalWhenConfigured(config…)` decides required-vs-optional **once** |
| Tool list | `TOOL_REGISTRATIONS`, minus whatever the effect gate refused — no dynamic registration |
| Write capability | `GITHUB_ALLOW_WRITES` is read once. **Enabling writes needs a restart**, and so does turning them off — the tool is already registered ([ADR-0007](../../03-decisions/ADR-0007-writes-behind-declared-capability.md)) |

So a server started before `GITHUB_DEFAULT_OWNER` was set advertises `owner` as
**required**, and keeps advertising it as required for the life of the process.
Restart from the client after any `.env` change. See
[debugging](../../06-workflows/debugging.md).

## What is *not* fixed

- The Octokit instance is shared, but each call is independent.
- No caching, no memoisation, no accumulated state between calls.
- Rate-limit budget *is* shared, since it belongs to the token — a long session
  can exhaust the ~30/min search limit across many calls.

## Statelessness

Tool calls are independent: nothing is stored between them, and restarting loses
nothing. Two things this buys:

- Restarting is always a safe fix.
- No conversation state can leak between calls.

And one it costs: no cursor can be held server-side, which is why lists are
truncated rather than paginated — see
[data flows](../data-flows.md#truncation-not-pagination).

## Failure at each phase

| Phase | Typical failure | Symptom |
| --- | --- | --- |
| ① Spawn | Wrong/relative path in `mcp.json`, `bun` not on `PATH` | Server never appears |
| ② Initialise | Throw at module top level | Immediate exit; check client MCP logs |
| ② Initialise | Anything written to `stdout` | Transport corrupted, client drops server |
| ③ Handshake | Model lacks tool-calling support | Server healthy, tools silently never called |
| ④ Serve | API error, missing default | Error result to the model — [failure modes](../../05-harness/failure-modes.md) |
| ⑤ Exit | — | Nothing to clean up |

Because ② has no error channel yet — the transport isn't connected — a startup
crash is visible **only** in the client's MCP logs.

## Related

[MCP server](mcp-server.md) · [Setup and registration](setup-and-registration.md) ·
[Constraints](../../01-context/constraints.md#transport) ·
[Debugging](../../06-workflows/debugging.md)
