---
type: architecture
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-03
summary: How client, server, toolbox, mappers and the external API fit together, and where each concern lives.
read_when:
  - you need the whole picture before changing anything
  - deciding which layer a change belongs in
code_refs:
  - tools/github/src/index.ts
  - tools/github/src/toolbox/index.ts
  - scripts/setup-tools.mjs
tags:
  - architecture
  - overview
---

# System overview

Three layers, deliberately thin: an **orchestration layer** that installs and
registers servers, a **server layer** that speaks MCP, and a **integration
layer** that talks to an external API and shrinks its answers.

## The map

```
┌─────────────────────────────────────────────────────────┐
│  MCP client  (LM Studio · Claude Code · Cline)          │
│  loads a tool-capable model, spawns servers             │
└───────────────────────┬─────────────────────────────────┘
                        │  JSON-RPC over stdio
                        │  (stdout is the wire — see constraints)
┌───────────────────────▼─────────────────────────────────┐
│  MCP server            tools/github/src/index.ts        │
│                                                          │
│  .env ──► ServerConfig ──► buildServerInstructions()     │
│              │                     └─► system prompt     │
│              ▼                                           │
│    TOOL_REGISTRATIONS ─(gate)─► registerTool() × n       │
└───────────────────────┬─────────────────────────────────┘
                        │  registration.register(server, config)
┌───────────────────────▼─────────────────────────────────┐
│  Toolbox               src/toolbox/tools/*.ts           │
│    zod inputSchema  ·  default resolution  ·  handler    │
└───────────┬───────────────────────────┬─────────────────┘
            │                           │
┌───────────▼─────────┐     ┌───────────▼─────────────────┐
│  utils/             │     │  Octokit ──► GitHub REST    │
│  query building     │     └───────────┬─────────────────┘
└─────────────────────┘                 │  GithubApi* shape
                            ┌───────────▼─────────────────┐
                            │  mappers/  ──► GithubCompact*│
                            │  JSON.stringify ──► model    │
                            └─────────────────────────────┘
```

## Layers and their jobs

| Layer | Lives in | Owns | Must not |
| --- | --- | --- | --- |
| Orchestration | [`scripts/`](../../scripts/README.md) | Install, build, register servers in the client | Know anything runtime-specific — that's `tool.json` |
| Bootstrap | `src/index.ts` | Read `.env`, build `ServerConfig`, register tools, connect stdio | Contain tool logic |
| Instructions | `src/server_instructions.ts` | Tell the model what the server already knows | Restate a default that isn't configured |
| Toolbox | `src/toolbox/` | Schemas, defaults, handlers, error messages | Reshape API payloads inline |
| Models | `src/models/` | The API shape *and* the compact shape, as types | Contain logic |
| Mappers | `src/mappers/` | API shape → compact shape, purely | Call the network |
| Utils | `src/utils/` | Pure helpers, e.g. query construction | Hold state |
| Shared | [`tools/shared/`](../../tools/shared/src/index.ts) | Cross-server guards and description helpers | Know about GitHub |

Each is detailed under [components/](components/README.md):
[MCP server](components/mcp-server.md) ·
[tool package](components/tool-package.md) ·
[shared package](components/shared-package.md) ·
[github server](components/github-server.md) ·
[execution lifecycle](components/execution-lifecycle.md) ·
[setup and registration](components/setup-and-registration.md).

## The two shapes rule

Every external object exists twice: as the API returns it (`GithubApiIssue`) and
as the model sees it (`GithubCompactIssue`), with exactly one pure function
between them. This is the load-bearing idea of the whole repo — it is what keeps
responses inside a local context window, and it means dropping a field is a
one-line change in one file.

See [data flows](data-flows.md) and [data schemas](../04-contracts/data-schemas.md).

## Adding to the system

- A **tool** touches `toolbox/tools/`, `toolbox/index.ts`, and possibly
  `models/` + `mappers/`. Nothing else.
  → [tool contract](../04-contracts/tool-contract.md)
- A **server** is a new folder under `tools/`, scaffolded by
  `scripts/create-tool.mjs`, registered by `scripts/setup-tools.mjs`.
  → [MCP server contract](../04-contracts/mcp-server-contract.md)
- A **cross-cutting change** needs an ADR first.
  → [decisions](../03-decisions/README.md)

## Why it's shaped this way

| Property | Decision |
| --- | --- |
| Local process, stdio, no host | [ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md) |
| Bun workspaces, no build step | [ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md) |
| Writes behind a declared effect class and a startup gate | [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md), superseding [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) |
| One server per integration | [ADR-0004](../03-decisions/ADR-0004-server-per-integration.md) |
