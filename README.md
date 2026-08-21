# llm_tools

A personal collection of **local MCP servers** (Model Context Protocol) that add custom
tools to a local LLM runtime — primarily [LM Studio](https://lmstudio.ai), but any
MCP-compatible client (Claude Code, Claude Desktop, Cline, …) can use them.

Each tool lives in its own folder, is written in TypeScript, talks to the client over
**stdio**, and runs entirely on your machine: no proxy, no hosted gateway, your
credentials stay in a local `.env`.

> **Heads up:** tool calling only works with models that support it. In LM Studio, look
> for the **tool use / function calling** badge on the model card (e.g. Qwen 3, Llama 3.x,
> Mistral, GPT-OSS). A model without that capability will simply ignore the tools.

---

## Available tools

| Tool                                                     | Version | Description                                 | Tools exposed        |
| -------------------------------------------------------- | ------- | ------------------------------------------- | -------------------- |
| [github_issues_manager](github_issues_manager/README.md) | 1.1.0   | Local MCP server for managing GitHub issues | `list_github_issues` |

Each folder has its own README covering the tools it exposes, its parameters and its
configuration. This file only covers what is common to all of them.

---

## Repository layout

```
llm_tools/
├── README.md                   # you are here — catalogue + shared setup
├── scripts/
│   └── setup-tools.mjs         # installs, builds and registers every tool
└── github_issues_manager/      # one folder = one MCP server, with its own README
    └── tool.json               # how to install, build and launch this server
```

---

## Requirements

- **Node.js 20+** (developed on Node 25)
- npm
- LM Studio **0.3.17 or later** (the version that introduced MCP support), or any other
  MCP client

---

## Getting started

Clone the repository, then let the setup script do the rest:

```bash
git clone <this-repo> llm_tools
cd llm_tools

node scripts/setup-tools.mjs
```

It walks every tool directory, runs its setup and build steps, and prints an `mcp.json`
fragment covering all of them, with absolute paths already filled in. Add `--write` to
merge that fragment straight into `~/.lmstudio/mcp.json`:

```bash
node scripts/setup-tools.mjs --write
```

| Option           | Effect                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `--only <name>`  | Restrict to one tool directory. Repeatable.                                                        |
| `--dev`          | Emit the "run from TypeScript sources" launch command instead of the built entry point.            |
| `--skip-install` | Don't run the setup step.                                                                          |
| `--skip-build`   | Don't run the build step.                                                                          |
| `--json-only`    | Print the fragment only — no setup, no build. Logs go to stderr, so this is pipeable.              |
| `--write`        | Merge into `~/.lmstudio/mcp.json`. The existing file is backed up and other servers are preserved. |
| `-h`, `--help`   | Show the help.                                                                                     |

Each tool still needs its credentials. The script warns when a tool has an `.env.example`
but no `.env`:

```bash
cp github_issues_manager/.env.example github_issues_manager/.env
```

`.env` files are git-ignored (only `.env.example` is tracked), so your tokens never leave
your machine. The variables each tool understands are documented in its own README.

Prefer doing it by hand? Every step is just `npm install` / `npm run build` inside the tool
folder, followed by the manual registration below.

---

## Registering a server in LM Studio by hand

This is what `scripts/setup-tools.mjs` automates — useful to know when something
misbehaves, or when you'd rather not run the script.

1. **Build the server** so LM Studio has a plain JS entry point to run:

   ```bash
   cd <tool_name>
   npm run build
   ```

2. **Open the MCP config** in LM Studio: right sidebar → **Program** → _Install_ →
   **Edit `mcp.json`**. (The file lives at `~/.lmstudio/mcp.json`.)

3. **Register the server** with an absolute path to the built file, where `/abs/path`
   stands for the absolute path to your local clone:

   ```json
   {
     "mcpServers": {
       "<tool_name>": {
         "command": "node",
         "args": ["/abs/path/llm_tools/<tool_name>/dist/index.js"]
       }
     }
   }
   ```

   Add one entry per server as the collection grows. If you prefer running the TypeScript
   directly — no build step, slower start, handy while iterating — point the command at
   the tool's local `tsx` binary instead:

   ```json
   {
     "mcpServers": {
       "<tool_name>": {
         "command": "/abs/path/llm_tools/<tool_name>/node_modules/.bin/tsx",
         "args": ["/abs/path/llm_tools/<tool_name>/src/index.ts"]
       }
     }
   }
   ```

4. **Save.** LM Studio starts the server and the tool appears in the chat's plugin
   picker. Enable it there.

5. **Load a tool-capable model** and ask for something the tool covers. LM Studio shows a
   confirmation prompt before the first call — MCP tool calls are always user-approved.

Each tool's README repeats this snippet with its real name and paths, ready to paste.

### If it doesn't show up

- Check the path in `mcp.json` is absolute and that `dist/index.js` exists
  (`npm run build`).
- Check LM Studio's MCP logs (developer/console panel) — a crash on startup is usually a
  missing `npm install` or a malformed `.env`.
- Make sure the loaded model actually advertises tool support.
- Anything the server writes to stdout that isn't MCP protocol will break the transport,
  so keep debug logging on `stderr`.
- After rebuilding, restart the server from LM Studio to pick up the changes.

---

## Local development & testing

Run a server against the official MCP Inspector to exercise its tools without going
through LM Studio:

```bash
cd <tool_name>
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Or start it directly — it will just wait for stdio traffic:

```bash
npm start
```

---

## Adding a new tool

1. Create a folder at the repo root (`snake_case`, one server per concern).
2. `npm init`, add `@modelcontextprotocol/server`, `zod` and `dotenv`; set
   `"type": "module"` and copy the `tsconfig.json` from `github_issues_manager`.
3. Follow the same shape: `metadata.ts` for constants, `models/` for the compact types
   handed to the LLM, `mappers/` for the API→model translation, `index.ts` for
   `server.registerTool(...)` and the stdio transport.
4. Write **descriptions for the LLM, not for humans** — the tool and parameter
   descriptions are the entire prompt the model gets. Mentioning fallbacks explicitly
   (_"Do not ask for owner or repository"_) noticeably reduces useless clarifying
   questions from smaller local models.
5. Keep responses compact. Local models have small context windows; map away every field
   the model doesn't need.
6. Add a `tool.json` (see below) so `scripts/setup-tools.mjs` picks the folder up.
7. Add a `.env.example` and a `README.md` following the same structure as the existing
   tools, then add a row to the [Available tools](#available-tools) table above.

---

## The `tool.json` manifest

Each tool declares how it is installed, built and launched, so the root script stays
runtime-agnostic — a Python or Go MCP server drops in without touching
`scripts/setup-tools.mjs`.

```json
{
  "mcpServerName": "github_issues_manager",
  "setup": "npm install",
  "build": "npm run build",
  "command": "node",
  "args": ["dist/index.js"],
  "dev": {
    "command": "node_modules/.bin/tsx",
    "args": ["src/index.ts"]
  }
}
```

| Field           | Meaning                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `mcpServerName` | Key used in `mcp.json`. Defaults to the `name` in `package.json`, then the folder name.                     |
| `setup`         | Shell command for the install step. `null` means "no setup step".                                           |
| `build`         | Shell command for the build step. `null` means "no build step".                                             |
| `command`       | Executable the client launches. Relative paths are resolved against the tool folder; bare names hit `PATH`. |
| `args`          | Arguments passed to it. Any value containing a `/` is turned into an absolute path.                         |
| `dev`           | Alternative `command` / `args` used by `--dev`.                                                             |
| `env`           | Extra environment variables to write into the `mcp.json` entry. Optional — secrets belong in `.env`.        |
| `description`   | Shown while the script runs. Falls back to `package.json`.                                                  |
| `version`       | Same, falls back to `package.json`.                                                                         |

Everything is optional. A tool with no `tool.json` at all still works if it has a
`package.json`: the script falls back to `npm install`, `npm run build` (only when that
script exists) and `node dist/index.js`.

For steps that don't fit on one line, drop an executable `setup.sh` or `build.sh` in the
tool folder — the script prefers it over the npm defaults. Precedence per step is
`tool.json` → `setup.sh` / `build.sh` → npm default.
