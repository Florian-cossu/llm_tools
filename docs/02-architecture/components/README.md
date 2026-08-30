---
type: index
status: active
scope: repo
last_reviewed: 2026-08-30
summary: Index of component notes - one per named piece of the system.
tags:
  - index
  - component
---

# Components

One note per piece. Ordered roughly by how often they are opened.

| Component | Covers | Scope |
| --- | --- | --- |
| [Tool package](tool-package.md) | Anatomy of a `tools/<name>/` folder, `tool.json` | repo |
| [MCP server](mcp-server.md) | The `index.ts` bootstrap, `ServerConfig`, instructions | mcp |
| [Shared package](shared-package.md) | `@llm-tools/shared` and the three-places rule | shared |
| [github server](github-server.md) | The one shipping server, and its scaffold tool | github |
| [Execution lifecycle](execution-lifecycle.md) | Spawn → init → serve → exit, and what is fixed when | mcp |
| [Setup and registration](setup-and-registration.md) | `setup-tools.mjs`, `mcp.json`, registering by hand | scripts |

Whole picture: [system overview](../system-overview.md).
