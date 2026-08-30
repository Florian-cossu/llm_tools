---
type: component
status: active
scope: mcp
last_reviewed: 2026-08-30
summary: The bootstrap pattern every server follows - env to ServerConfig to instructions to tool registration to stdio.
read_when:
  - writing or changing a server's index.ts
  - adding a value to ServerConfig
code_refs:
  - tools/github/src/index.ts
  - tools/github/src/metadata.ts
  - tools/github/src/server_instructions.ts
tags:
  - component
  - mcp
  - bootstrap
---

# MCP server (bootstrap)

Every server's `src/index.ts` does the same five things in the same order. The
file is deliberately short and holds **no tool logic**.

Interface rules: [MCP server contract](../../04-contracts/mcp-server-contract.md).

## The five steps

```ts
// 1. Load .env — quiet, because stdout is the JSON-RPC channel
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

// 2. Build the per-server context, once
const token = stringOrNull(process.env.GITHUB_TOKEN);
const octokit = new Octokit({ auth: token });
const config: ServerConfig = {
  serverName: APP_NAME, serverVersion: APP_VERSION,
  token, octokit,
  defaultUsername:   stringOrNull(process.env.GITHUB_DEFAULT_USERNAME),
  defaultOwner:      stringOrNull(process.env.GITHUB_DEFAULT_OWNER),
  defaultRepository: stringOrNull(process.env.GITHUB_DEFAULT_REPOSITORY),
};

// 3. Construct the server, with instructions derived from config
const server = new McpServer(
  { name: APP_NAME, version: APP_VERSION },
  { instructions: buildServerInstructions(config) },
);

// 4. Register every tool, handing each the same config
for (const registerTool of TOOL_INSTANCES) registerTool(server, config);

// 5. Connect stdio and hand control to the transport
await server.connect(new StdioServerTransport());
```

## `ServerConfig`

The one object threaded through everything. Built once; every tool closes over
it.

| Field | Source | Used for |
| --- | --- | --- |
| `serverName`, `serverVersion` | `metadata.ts` ← `package.json` | MCP handshake identity |
| `token` | `.env` | Auth; `null` means unauthenticated |
| `octokit` | constructed | The API client, shared by all tools |
| `defaultUsername` | `.env` | Resolving the `@me` sentinel |
| `defaultOwner` | `.env` | Owner fallback |
| `defaultRepository` | `.env` | Repository fallback |

Adding a field means: extend the type, read it with `stringOrNull`, and decide
whether it belongs in the [server instructions](#server-instructions) too.

> [!important]
> `stringOrNull` — not `??` — is what normalises `.env`. An unset variable and
> an empty one (`GITHUB_TOKEN=`) must both become `null`, and `??` only catches
> the first. See [shared package](shared-package.md).

## Identity comes from `package.json`

`metadata.ts` re-exports `name` and `version` from `package.json` via a JSON
import, so the version the client displays cannot drift from the package.
Constants that are genuinely server-level (`DEFAULT_ISSUE_STATE`,
`DEFAULT_ISSUE_LIMIT`, `GITHUB_API_BASE_URL`) live there too, so a default is
stated once and referenced from both the schema and its description.

## Server instructions

`buildServerInstructions(config)` returns the text the client places in the
**system prompt**. It is assembled conditionally — a paragraph is emitted only
when the config that justifies it is present, so a server without defaults never
promises one.

Currently emitted:

1. **Repository paragraph** (when owner *and* repository are set) — tells the
   model to call tools without those parameters and never to ask the user.
2. **Identity paragraph** (when username is set) — maps "my issues" onto
   `assignee:@me`.

Why here and not only in the tool descriptions: the system prompt is read while
the model is deciding *whether it can answer at all*; a tool description is read
only after it has decided to reach for that tool. A default stated only in the
description arrives too late to prevent a clarifying question. Same reasoning,
applied per-parameter, in [shared package](shared-package.md) and the
[agent contract](../../04-contracts/agent-contract.md).

## Rules

- **Never write to `stdout`.** It is the wire. Diagnostics go to `stderr` —
  [observability](../../05-harness/observability.md).
- **No I/O before `connect()`** beyond reading `.env`.
- **No tool logic here.** It belongs in `toolbox/tools/`.
- **Fail loudly at startup** for a broken config; fail *per call* for a missing
  optional default, so the model gets an actionable message.

Next: [execution lifecycle](execution-lifecycle.md) · [tool package](tool-package.md)
