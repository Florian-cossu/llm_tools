---
type: index
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: Index of the contracts - the interfaces that must hold, and the highest-traffic notes in the vault.
tags:
  - index
  - contract
---

# 04-contracts

Interfaces that must hold. Together with [03-decisions](../03-decisions/README.md)
these are the most authoritative prose here: code that violates a contract is a
bug, not a variation.

| Contract | Binds | Read before |
| --- | --- | --- |
| [MCP server contract](mcp-server-contract.md) | Every server under `tools/` | Creating a server |
| [Tool contract](tool-contract.md) | Every file in `toolbox/tools/` | Adding or changing a tool |
| [Agent contract](agent-contract.md) | Every string a model reads | Writing any description |
| [Data schemas](data-schemas.md) | API and compact shapes, mappers | Changing a response |
| [GitHub API](github-api.md) | Endpoints, quirks, rate limits | Calling GitHub |
| [Security and secrets](security-and-secrets.md) | Credentials, fixtures, output | Any commit touching config |

> [!tip]
> The [agent contract](agent-contract.md) is the unusual one. The others govern
> code; it governs the prompt surface — and a tool that satisfies every other
> contract can still be broken if the model will not use it correctly.
