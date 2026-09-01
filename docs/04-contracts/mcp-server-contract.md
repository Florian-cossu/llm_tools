---
type: contract
status: active
scope: mcp
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: What every MCP server in this repository must provide, guarantee and never do.
read_when:
  - creating a new MCP server
  - reviewing a server before registering it
code_refs:
  - tools/github/src/index.ts
  - tools/github/tool.json
tags:
  - contract
  - mcp
  - server
---

# MCP server contract

Binding on every folder under `tools/` that is not `shared/`.
Per-tool rules: [tool contract](tool-contract.md).

## MUST provide

| # | Requirement | Verified by |
| --- | --- | --- |
| S1 | `tool.json` declaring `command`, `args`, and `setup`/`build` (`null` when absent) | `setup-tools.mjs` discovery |
| S2 | `package.json` named `@llm-tools/<name>` with a meaningful `version` | Handshake shows the version |
| S3 | `.env.example` listing **every** variable read, with a comment on each | Copy it, server starts |
| S4 | `README.md`: tools exposed, parameters, example prompts, response samples | Manual |
| S5 | `src/index.ts` following the [bootstrap pattern](../02-architecture/components/mcp-server.md) | Manual |
| S6 | Identity (`name`, `version`) sourced from `package.json` via `metadata.ts` | Manual |
| S7 | A row in the root [Available tools](../../README.md#available-tools) table | Manual |

## MUST guarantee

| # | Guarantee | Why |
| --- | --- | --- |
| S8 | **Nothing but MCP protocol on `stdout`** | It is the wire. Anything else drops the server — [constraints](../01-context/constraints.md#transport) |
| S9 | Starts successfully with **no `.env` present** | A missing credential is a per-call error, not a crash. Keeps the server inspectable |
| S10 | No credential in any log line, error message or response | [security and secrets](security-and-secrets.md) |
| S11 | Read-only, unless an ADR supersedes [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) | The model is an untrusted caller |
| S12 | Config read **once** at startup; no reads of `process.env` per call | [execution lifecycle](../02-architecture/components/execution-lifecycle.md) |
| S13 | Tool calls are stateless and independent | Restart is always safe |

> [!important] S9 is easy to get wrong
> Throwing at module top level when a token is missing makes the server exit
> during initialisation — *before* the transport is connected, so the model
> never learns why. The github server instead constructs Octokit with
> `auth: null` and lets each call fail with a message the model can act on.

## MUST NOT

- Open a network listener, or use a non-stdio transport
  ([ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md)).
- Read secrets from `mcp.json`'s `env` — that file is not git-ignored. `.env`
  only.
- Register tools conditionally on runtime state. `TOOL_INSTANCES` is static;
  gating on config at *startup* is fine, gating per call is not.
- Cache API responses between calls.
- Depend on another server, or on a second integration's credentials
  ([ADR-0004](../03-decisions/ADR-0004-server-per-integration.md)).
- Require a build step, unless the server documents why
  ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md)).

## SHOULD

- Emit [server instructions](../02-architecture/components/mcp-server.md#server-instructions)
  when configured defaults exist — the model reads them before deciding whether
  it needs a tool at all.
- Build those instructions **conditionally**, so a server without defaults never
  promises one.
- Normalise every `.env` read through `stringOrNull`, so unset and empty behave
  identically.
- Keep server-level constants in `metadata.ts`, referenced from both schema and
  description, so a default is stated once.

## Acceptance checklist

Before registering a server in a client:

```bash
bun install
npx @modelcontextprotocol/inspector bun run tools/<name>/src/index.ts
```

- [ ] Starts with **no** `.env` — S9
- [ ] Starts with a **complete** `.env`
- [ ] Handshake reports the expected name and version — S2, S6
- [ ] Every expected tool is listed, under its public name
- [ ] Instructions appear, and mention configured defaults only when set
- [ ] Nothing non-protocol on `stdout` — S8
- [ ] An invalid parameter yields a useful error, not a crash
- [ ] No mutating endpoint anywhere in the source — S11
- [ ] No token in any output — S10

Full procedure: [testing](../06-workflows/testing.md) ·
[local development](../06-workflows/local-development.md).
