---
type: component
status: active
scope: mcp
last_reviewed: 2026-08-30
last_updated: 2026-09-09
summary: The bootstrap pattern every server follows - env to ServerConfig to instructions to tool registration to stdio.
read_when:
  - writing or changing a server's index.ts
  - adding a value to ServerConfig
code_refs:
  - tools/github/src/index.ts
  - tools/github/src/metadata.ts
  - tools/github/src/server_instructions.ts
  - tools/github/src/utils/get_repo_config.ts
  - data/access.ts
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

// 2. Build the per-server context. The object itself is built once, but
//    `token`, `octokit`, `defaultOwner` and `defaultRepository` are getters
//    (see ServerConfig below) - read fresh on every access, not cached here
const config: ServerConfig = {
  serverName: APP_NAME, serverVersion: APP_VERSION,
  get token() { return resolveActiveToken(); },
  get octokit() { return new Octokit({ auth: this.token }); },
  defaultUsername: stringOrNull(process.env.GITHUB_DEFAULT_USERNAME),
  get defaultOwner() { return stringOrNull(getActiveGithubProfile()?.repository_owner); },
  get defaultRepository() { return stringOrNull(getActiveGithubProfile()?.repository_name); },
};

// 3. Decide what may be registered at all — a tool whose permission-table
//    row isn't `allow` is skipped here and never seen (ADR-0008, ADR-0009)
const allowed = TOOL_REGISTRATIONS.filter(
  (r) => isToolAllowed(r.name, "github"),
);

// 4. Construct the server. Instructions are built from what the gate
//    allowed, so a read-only promise is only made when it is true
const server = new McpServer(
  { name: APP_NAME, version: APP_VERSION },
  { instructions: buildServerInstructions(config, allowed) },
);

// 5. Register what survived, handing each the same config
for (const registration of allowed) registration.register(server, config);

// 6. Connect stdio and hand control to the transport
await server.connect(new StdioServerTransport());
```

## `ServerConfig`

The one object threaded through everything - the object itself is built once,
but four of its fields are **getters**, not plain values, so every tool
handler (which reads `config.foo` at call time, inside its `async` body) sees
whatever is currently active rather than whatever was active at startup.

| Field | Source | Read | Used for |
| --- | --- | --- | --- |
| `serverName`, `serverVersion` | `metadata.ts` ← `package.json` | once, at startup | MCP handshake identity |
| `token` | `.env`, under whichever key is the active `auth` token (`getActiveTokenName`) | **per access** | Auth; `null` means unauthenticated |
| `octokit` | constructed from `this.token` | **per access** | The API client - a fresh instance each time, so a changed token is picked up |
| `defaultUsername` | `.env` | once, at startup | Resolving the `@me` sentinel |
| `defaultOwner` | active `github_profiles` row | **per access** | Owner fallback |
| `defaultRepository` | active `github_profiles` row | **per access** | Repository fallback |

This is why switching the active token or profile in the control panel takes
effect on a tool's very next call, no restart - unlike the permission table
(ADR-0008), which still gates tool *registration* and does need one. The one
place this doesn't reach is the tool **descriptions and input schemas**
(e.g. `describeConfiguredRepository` in each tool file): those read
`config.defaultOwner` etc. once, synchronously, while
`registration.register(server, config)` builds the description/schema
strings - so the *text* shown to the model still reflects whatever was active
at the last restart, even though the tool's actual behavior is already
current. Closing that gap means dynamic re-registration
(`server.sendToolListChanged()`), not a `ServerConfig` change - see
[current plan](../../07-plans/current.md).

Adding a field means: extend the type, read it with `stringOrNull`, and decide
whether it belongs in the [server instructions](#server-instructions) too -
and whether it should be a getter (re-read per call) or a plain value (fixed
at startup), depending on whether anything outside the process can change it
while the server is running.

> [!important]
> `stringOrNull` — not `??` — is what normalises a possibly-empty value,
> whether it comes from `.env` (an unset variable and an empty one, e.g. the
> active token's key with no value after it, must both become `null`) or from the database (no active
> profile means `activeProfile` itself is `null`, so `activeProfile?.repository_owner`
> is `undefined`, which `stringOrNull` also turns into `null`) — `??` only
> catches one of these cases. See [shared package](shared-package.md).

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
