---
type: component
status: active
scope: repo
last_reviewed: 2026-08-30
summary: Anatomy of a tools/<name>/ server folder - the files, the tool.json manifest, and what each directory owns.
read_when:
  - creating a new MCP server
  - deciding which file a piece of code belongs in
code_refs:
  - tools/README.md
  - tools/github/tool.json
  - tools/github/package.json
tags:
  - component
  - structure
  - scaffolding
---

# Tool package

One folder under `tools/` is one MCP server, one integration, one credential
set — see [ADR-0004](../../03-decisions/ADR-0004-server-per-integration.md).

Prose version with more examples: [`tools/README.md`](../../../tools/README.md).

## Layout

```
tools/<name>/
├── .env.example                # credentials template — copy to .env
├── .env                        # git-ignored, never committed
├── tool.json                   # install / launch manifest
├── package.json                # name = @llm-tools/<name>, version = server version
├── tsconfig.json               # extends ../../tsconfig.json
├── README.md                   # user-facing: tools, parameters, examples
└── src/
    ├── index.ts                # bootstrap — see mcp-server.md
    ├── metadata.ts             # name/version from package.json + constants
    ├── server_instructions.ts  # system-prompt text, built from config
    ├── models/                 # <X>Api<Y> and <X>Compact<Y> types
    ├── mappers/                # Api shape → Compact shape, pure
    ├── utils/                  # pure helpers (query building, …)
    └── toolbox/
        ├── index.ts            # ToolInstance type + TOOL_INSTANCES
        └── tools/              # one file per tool
```

## What each directory owns

| Directory | Owns | Must not |
| --- | --- | --- |
| `models/` | Types only — the API shape *and* the compact shape | Contain logic |
| `mappers/` | One pure function per shape pair | Touch the network or `config` |
| `utils/` | Stateless helpers | Hold state |
| `toolbox/tools/` | Schema, defaults, handler, error messages | Reshape payloads inline — call a mapper |
| `toolbox/index.ts` | The registration list | Contain tool logic |

The split matters because dropping a field from what the model sees must be a
one-line change in exactly one file. See
[data schemas](../../04-contracts/data-schemas.md).

## `tool.json`

The install-and-launch manifest. It exists so
[`setup-tools.mjs`](setup-and-registration.md) never needs to know a server's
runtime — a Python or Go MCP server drops in unchanged.

```json
{
  "mcpServerName": "github",
  "setup": "bun install",
  "build": null,
  "command": "bun",
  "args": ["run", "src/index.ts"],
  "dev": { "command": "bun", "args": ["run", "src/index.ts"] }
}
```

| Field | Meaning |
| --- | --- |
| `mcpServerName` | Key written into `mcp.json`. Falls back to `package.json` `name`, then the folder name |
| `setup` | Install command. `null` = no step |
| `build` | Build command. `null` = no step — the norm here, Bun runs TS directly |
| `command` | Executable the client launches. A bare name resolves on `PATH` |
| `args` | Arguments. **Any value containing `/` is rewritten to an absolute path** |
| `dev` | Alternative `command`/`args` used under `--dev` |
| `env` | Extra environment written into the `mcp.json` entry. **Not for secrets** — those live in `.env` |

## Scaffolding a server

```bash
node scripts/create-tool.mjs linear --description "Linear issue tracker"
```

Name is lowercased with non-alphanumerics turned into dashes; the script refuses
to overwrite. It writes `package.json`, `tool.json`, `tsconfig.json`,
`.env.example` and `src/` including one `example_tool.ts` to replace.

It does **not** write a `README.md`, and does **not** add the row to the root
[Available tools](../../../README.md#available-tools) table — both are manual.

Then: [MCP server contract](../../04-contracts/mcp-server-contract.md) for what
the server must satisfy, and [tool contract](../../04-contracts/tool-contract.md)
for each tool.

## Adding a tool to an existing server

1. Create `src/toolbox/tools/<tool_name>.ts` exporting a `ToolInstance`.
2. Add it to `TOOL_INSTANCES` in `src/toolbox/index.ts` — **a tool absent from
   this list does not exist.**
3. Document it in the server's `README.md`.
4. Restart the server from the client.

The github server scaffolds steps 1–2:

```bash
node tools/github/scripts/add-new-implementation.mjs close_github_issue \
  --description "Close a single issue by its number."
```

It emits the file with owner/repository parameters, `.env` fallbacks and error
handling already wired, leaving two `TODO`s: the real `inputSchema` parameters,
and the API call plus its mapping. See [github server](github-server.md#adding-a-tool).

## Workspace wiring

`tools/*` and `tools/shared/*` are Bun workspaces from the root
`package.json`. A server depends on shared with `"@llm-tools/shared":
"workspace:*"`, and the root `tsconfig.json` maps the import to source — no
build, no publish. See [ADR-0002](../../03-decisions/ADR-0002-bun-workspaces.md)
and [shared package](shared-package.md).
