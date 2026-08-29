# tools

One folder per MCP server, plus `shared/` — the utilities they all import.

| Folder                        | Package               | Description                             |
| ----------------------------- | --------------------- | --------------------------------------- |
| [github](github/README.md)    | `@llm-tools/github`   | GitHub issues and milestones, read-only |
| [shared](shared/)             | `@llm-tools/shared`   | Helpers shared by every server          |

Scaffold a new one with
[`node scripts/create-tool.mjs <name>`](../scripts/README.md#create-toolmjs).

---

## Anatomy of a server

```
tools/<name>/
├── .env.example                # credentials template — copy to .env
├── tool.json                   # install / launch contract for setup-tools.mjs
├── package.json
├── tsconfig.json               # extends ../../tsconfig.json
├── README.md
└── src/
    ├── index.ts                # bootstrap: reads .env, builds ServerConfig, registers tools
    ├── metadata.ts             # constants (name and version from package.json, API defaults)
    ├── server_instructions.ts  # system prompt injected into the MCP session
    ├── models/                 # API shapes + the compact shapes handed to the LLM
    ├── mappers/                # API payload → compact model
    ├── utils/
    └── toolbox/
        ├── index.ts            # TOOL_INSTANCES — the list of tools to register
        └── tools/              # one file per tool
```

`index.ts` builds a `ServerConfig` (credentials, API client, defaults from `.env`) and
passes it to every tool. A tool module exports a `ToolInstance` —
`(server, config) => void` — and adding a tool means writing its file and listing it in
`toolbox/index.ts`.

---

## `tool.json`

Each tool declares how it is installed and launched, which keeps
[`setup-tools.mjs`](../scripts/README.md) runtime-agnostic: a Python or Go MCP server
drops in without touching the script.

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

| Field           | Meaning                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------- |
| `mcpServerName` | Key used in `mcp.json`. Defaults to `name` in `package.json`, then the folder name.     |
| `setup`         | Shell command for the install step. `null` means "no setup step".                       |
| `build`         | Shell command for the build step. `null` means "no build step".                         |
| `command`       | Executable the client launches. Bare names hit `PATH`.                                  |
| `args`          | Arguments passed to it. Any value containing a `/` is turned into an absolute path.     |
| `dev`           | Alternative `command` / `args` used by `--dev`.                                         |
| `env`           | Extra environment variables written into the `mcp.json` entry. Secrets belong in `.env`. |

---

## `@llm-tools/shared`

Imported as `@llm-tools/shared` (workspace dependency, mapped in the root `tsconfig.json`).

| Export                                          | Purpose                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `isStringUsable` / `isStringUnusable`           | Type guards for "non-empty string".                                           |
| `stringOrNull`                                  | Trims, or returns `null` when unusable. Used to read `.env` values.           |
| `describeDefault(configured, whenMissing)`      | Parameter description that names the configured fallback, or says "required". |
| `describeConfiguredRepository(owner, repo)`     | Tool-description prefix telling the model the repository is already known.    |
| `optionalWhenConfigured(configured)`            | `z.string()` when nothing is configured, `z.string().optional()` otherwise.   |

The last three exist because a small model reads the tool description before it reads the
schema. If the description doesn't say a value is already known, the model asks the user
for it — so the fallback has to be stated in both places, and a parameter called
"required" in prose has to be required in the schema too.

---

## Writing tools for local models

- **Write descriptions for the LLM, not for humans.** Tool and parameter descriptions are
  the main signal the model uses to decide when and how to call a tool.
- **State fallbacks explicitly.** _"Do not ask for owner or repository when defaults are
  configured"_ noticeably reduces useless clarifying questions from smaller models.
- **Describe the response shape** in the tool description. It saves the model a round of
  guessing about what it just received.
- **Keep responses compact.** Local context windows are small. Map away every field the
  model doesn't need, and split list and detail into separate tools.
- **Never write to `stdout`.** It's the JSON-RPC channel — debug logging goes to `stderr`.
- **Never build.** Bun runs TypeScript directly.

---

## Adding a tool to an existing server

1. Create `src/toolbox/tools/<tool_name>.ts` exporting a `ToolInstance`.
2. Add it to `TOOL_INSTANCES` in `src/toolbox/index.ts`.
3. Document it in the server's `README.md`.
4. Restart the server from LM Studio.

The github server ships a script that does steps 1 and 2 for you — see its
[README](github/README.md#adding-a-tool).
