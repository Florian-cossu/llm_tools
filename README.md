# llm_tools

A personal collection of **local MCP servers** (Model Context Protocol) that add custom
tools to a local LLM runtime — primarily [LM Studio](https://lmstudio.ai), but any
MCP-compatible client (Claude Code, Claude Desktop, Cline, …) can use them.

Each tool lives under `tools/`, is written in TypeScript, talks to the client over
**stdio**, and runs entirely on your machine via [Bun](https://bun.sh): no proxy, no
hosted gateway, your credentials stay in a local `.env`.

> **Heads up:** tool calling only works with models that support it. In LM Studio, look
> for the **tool use / function calling** badge on the model card (e.g. Qwen 3, Llama 3.x,
> Mistral, Gemma 4). A model without that capability will simply ignore the tools.

---

## Available tools

| Tool                               | Version | Description                      | Tools exposed                                    |
|------------------------------------|---------|----------------------------------|--------------------------------------------------|
| [github](tools/github/README.md)   | 1.3.0   | MCP server for managing GitHub issues | `list_github_issues_by_repo`, `get_github_issue` |

Each folder has its own README covering the tools it exposes, its parameters and its
configuration. This file only covers what is common to all of them.

---

## Repository layout

```
llm_tools/
├── README.md                   # you are here — catalogue + shared setup
├── package.json                # Bun workspace root
├── bun.lock                    # single lockfile for all tools
├── tsconfig.json               # shared TypeScript config
├── scripts/
│   ├── setup-tools.mjs         # installs and registers every tool in LM Studio
│   └── create-tool.mjs         # scaffolds a new tool from a template
└── tools/
    ├── shared/                 # shared utilities (@llm-tools/shared)
    └── github/                 # one folder = one MCP server
        └── tool.json           # how to install and launch this server
```

---

## Requirements

- **Bun 1.3+** — install with `curl -fsSL https://bun.sh/install | bash`
- **LM Studio 0.3.17 or later** (the version that introduced MCP support), or any other
  MCP-compatible client

---

## Getting started

Clone the repository, install all dependencies and register the tools in LM Studio:

```bash
git clone <this-repo> llm_tools
cd llm_tools

bun install
node scripts/setup-tools.mjs --write
```

`bun install` installs dependencies for every workspace in one pass. The setup script
then walks every tool directory and merges a ready-to-use `mcp.json` fragment into
`~/.lmstudio/mcp.json`.

Each tool still needs its credentials:

```bash
cp tools/github/.env.example tools/github/.env
# then edit the file and fill in your values
```

`.env` files are git-ignored (only `.env.example` is tracked), so your tokens never leave
your machine.

---

## Setup script options

| Option           | Effect                                                                                             |
|------------------|----------------------------------------------------------------------------------------------------|
| `--only <name>`  | Restrict to one tool directory. Repeatable.                                                        |
| `--dev`          | Emit the "run from TypeScript sources" launch command (same as default with Bun).                  |
| `--skip-install` | Don't run the setup step.                                                                          |
| `--skip-build`   | Don't run the build step.                                                                          |
| `--json-only`    | Print the fragment only — no setup, no build. Logs go to stderr, so this is pipeable.              |
| `--write`        | Merge into `~/.lmstudio/mcp.json`. The existing file is backed up and other servers are preserved. |
| `-h`, `--help`   | Show the help.                                                                                     |

---

## Registering a server in LM Studio by hand

This is what `scripts/setup-tools.mjs` automates — useful to know when something
misbehaves.

1. **Open the MCP config** in LM Studio: right sidebar → **Program** → _Install_ →
   **Edit `mcp.json`**. (The file lives at `~/.lmstudio/mcp.json`.)

2. **Register the server** with absolute paths, where `/abs/path` stands for the absolute
   path to your local clone:

   ```json
   {
     "mcpServers": {
       "github": {
         "command": "bun",
         "args": ["/abs/path/llm_tools/tools/github/src/index.ts"]
       }
     }
   }
   ```

3. **Save.** LM Studio starts the server and the tool appears in the chat's plugin
   picker.

4. **Load a tool-capable model** and ask for something the tool covers.

### If it doesn't show up

- Check the path in `mcp.json` is absolute and that `src/index.ts` exists.
- Check LM Studio's MCP logs — a crash on startup is usually a missing `.env` or a
  misconfigured variable.
- Make sure the loaded model actually advertises tool support.
- Anything the server writes to `stdout` that isn't MCP protocol will break the
  transport — keep debug logging on `stderr`.

---

## Local development & testing

Run a server against the official MCP Inspector without going through LM Studio:

```bash
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

Or start it directly — it will wait for stdio traffic:

```bash
bun run start:github
```

---

## Adding a new tool

Use the scaffolding script to generate a ready-to-use skeleton:

```bash
node scripts/create-tool.mjs <tool-name> --description "What it does"
```

This creates the full directory structure under `tools/<tool-name>/` with a working
`index.ts`, `metadata.ts`, `server_instructions.ts`, a toolbox with an example tool,
`package.json`, `tool.json`, `tsconfig.json` and `.env.example`.

Then:

1. Fill in `tools/<tool-name>/.env.example`, then copy it to `.env`.
2. Implement your tools in `src/toolbox/tools/`.
3. Register them in `src/toolbox/index.ts`.
4. Run `node scripts/setup-tools.mjs --write` to register the server in LM Studio.
5. Add a row to the [Available tools](#available-tools) table above.
6. Add a `README.md` in the tool folder.

A few guidelines for writing tools for local models:

- **Write descriptions for the LLM, not for humans.** The tool and parameter descriptions
  are the main signal the model uses to decide when and how to call a tool.
- **State fallbacks explicitly.** Phrases like _"Do not ask for owner or repository when
  defaults are configured"_ noticeably reduce useless clarifying questions from smaller
  models.
- **Keep responses compact.** Local models have small context windows. Map away every
  field the model doesn't need; consider separate list and detail tools.
- **Never build.** Bun runs TypeScript directly — no compilation step needed.
- **Shared utilities** live in `tools/shared` and are available as `@llm-tools/shared`.

---

## The `tool.json` manifest

Each tool declares how it is installed and launched, keeping the root script
runtime-agnostic — a Python or Go MCP server drops in without touching
`scripts/setup-tools.mjs`.

```json
{
  "mcpServerName": "github",
  "setup": "bun install",
  "build": null,
  "command": "bun",
  "args": ["run", "src/index.ts"],
  "dev": {
    "command": "bun",
    "args": ["run", "src/index.ts"]
  }
}
```

| Field           | Meaning                                                                                                     |
|-----------------|-------------------------------------------------------------------------------------------------------------|
| `mcpServerName` | Key used in `mcp.json`. Defaults to the `name` in `package.json`, then the folder name.                     |
| `setup`         | Shell command for the install step. `null` means "no setup step".                                           |
| `build`         | Shell command for the build step. `null` means "no build step".                                             |
| `command`       | Executable the client launches. Bare names hit `PATH`.                                                      |
| `args`          | Arguments passed to it. Any value containing a `/` is turned into an absolute path.                         |
| `dev`           | Alternative `command` / `args` used by `--dev`.                                                             |
| `env`           | Extra environment variables to write into the `mcp.json` entry. Optional — secrets belong in `.env`.        |