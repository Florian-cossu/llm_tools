---
type: context
status: active
scope: repo
last_reviewed: 2026-08-30
summary: Vocabulary used across this vault - MCP terms, repo-specific types, and GitHub concepts.
read_when:
  - a term in another note is unfamiliar
  - naming a new type or concept
code_refs:
  - tools/github/src/index.ts
  - tools/github/src/toolbox/index.ts
  - tools/shared/src/index.ts
tags:
  - context
  - glossary
  - reference
---

# Glossary

## Protocol

### MCP
**Model Context Protocol.** The open protocol an LLM client uses to discover and
call tools provided by an external process. Every server here speaks it over
[stdio](#stdio-transport). See [MCP server contract](../04-contracts/mcp-server-contract.md).

### stdio transport
MCP carried over a child process's standard input and output as JSON-RPC. The
client spawns the server; `stdin`/`stdout` are the wire. Chosen in
[ADR-0001](../03-decisions/ADR-0001-local-stdio-transport.md).
**Consequence:** `stdout` is reserved — see [constraints](constraints.md#transport).

### MCP client
The program that launches servers and offers their tools to a model. Here:
LM Studio, Claude Code, Claude Desktop, Cline.

### server instructions
A block of guidance handed to the client at initialisation and placed in the
system prompt. Read by the model *before* it decides whether it needs a tool at
all — which is why defaults are stated here as well as in tool descriptions.
Built by [`server_instructions.ts`](../../tools/github/src/server_instructions.ts).

### tool description
Prose attached to a registered tool. The model's primary signal for *when* and
*how* to call it. Treated as a first-class interface here, not as a comment.
See [agent contract](../04-contracts/agent-contract.md).

---

## Repository types

### server
One MCP process, one integration, one folder under `tools/`. See
[ADR-0004](../03-decisions/ADR-0004-server-per-integration.md) and
[tool package](../02-architecture/components/tool-package.md).

### tool
One callable capability registered on a server, e.g. `get_github_issue`. One
file under `src/toolbox/tools/`. Governed by the
[tool contract](../04-contracts/tool-contract.md).

### `ToolInstance`
The single shape every tool module exports:
`(server: McpServer, config: ServerConfig) => void`. Registering a tool means
writing the file and adding it to `TOOL_INSTANCES`. Defined in
[`toolbox/index.ts`](../../tools/github/src/toolbox/index.ts).

### `TOOL_INSTANCES`
The array in `src/toolbox/index.ts` listing every tool the server exposes. The
registration list — if a tool isn't here, it doesn't exist.

### `ServerConfig`
The per-server context object built once at startup from `.env` and passed to
every tool: credentials, the API client, and the configured defaults. Defined in
[`index.ts`](../../tools/github/src/index.ts).

### `tool.json`
A server's install-and-launch manifest, read by
[`setup-tools.mjs`](../../scripts/setup-tools.mjs). Keeps orchestration
runtime-agnostic. See [setup and registration](../02-architecture/components/setup-and-registration.md).

### compact model / compact shape
The trimmed representation of an API object that is actually sent to the model —
`GithubCompactIssue`, `GithubCompactMilestone`. Produced by a
[mapper](#mapper) from the corresponding `…Api…` type. See
[data schemas](../04-contracts/data-schemas.md).

### mapper
A pure function from an API shape to a [compact shape](#compact-model--compact-shape).
Lives in `src/mappers/`. The single place a field is dropped or renamed.

### `@llm-tools/shared`
The workspace package every server imports for string guards and the helpers
that keep a parameter's prose and its schema in agreement. See
[shared package](../02-architecture/components/shared-package.md).

### configured default
A value from `.env` (`GITHUB_DEFAULT_OWNER`, …) that a tool substitutes when the
call omits it. Must be announced in **both** the schema and the prose, or the
model asks the user for it anyway.

### `@me` sentinel
GitHub search syntax resolving to the authenticated account. The server maps
"my issues" onto `assignee:@me` via the server instructions and
`GITHUB_DEFAULT_USERNAME`.

---

## GitHub

### issue vs pull request
GitHub's search API returns both. `is:issue` in every query is what keeps PRs
out — see [`github_search_query.ts`](../../tools/github/src/utils/github_search_query.ts).

### qualifier
A `key:value` term in a GitHub search query (`label:bug`, `assignee:@me`). Note
that `state:all` is **not** valid — omit the qualifier instead.

### milestone
A named, optionally dated grouping of issues. Modelled by
`GithubApiMilestone` / `GithubCompactMilestone`.

### Octokit
The official GitHub SDK. One instance per server, held on `ServerConfig`.
