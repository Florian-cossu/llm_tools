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

| Server | Version | Description | Tools exposed |
| --- | --- | --- | --- |
| [github_issues_manager](github_issues_manager/) | 1.1.0 | Local MCP server for managing GitHub issues | `list_github_issues` |

### `github_issues_manager`

Reads issues from the GitHub REST API and returns a **compact** payload (number, title,
url, state, labels, assignees, milestone) instead of the full GitHub response — which
keeps the context window usable on a local model.

| Tool | What it does | Parameters |
| --- | --- | --- |
| `list_github_issues` | Lists issues of a repository, newest-updated first. Pull requests are filtered out. | `owner` *(optional)*, `repository` *(optional)*, `state` (`open` \| `closed` \| `all`, default `open`), `limit` (1–100, default 30) |

`owner` and `repository` fall back to the values configured in `.env`, so in practice you
can just ask *"list the open issues"* without naming the repo.

---

## Repository layout

```
llm_tools/
├── README.md
├── llm_tools.code-workspace
└── github_issues_manager/          # one folder = one MCP server
    ├── .env.example                # credentials template (copy to .env)
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts                # server bootstrap + tool registration
    │   ├── metadata.ts             # constants & defaults (name, version, API base URL)
    │   ├── models/                 # compact domain types returned to the LLM
    │   │   ├── github_issues.ts
    │   │   └── github_milestones.ts
    │   └── mappers/                # GitHub API payload -> compact model
    │       └── github_compact_mappers.ts
    └── dist/                       # build output (git-ignored) — what LM Studio runs
```

---

## Requirements

- **Node.js 20+** (developed on Node 25)
- npm
- LM Studio **0.3.17 or later** (the version that introduced MCP support), or any other
  MCP client

---

## Setup

```bash
git clone <this-repo> llm_tools
cd llm_tools/github_issues_manager

npm install
cp .env.example .env      # then fill in your values
npm run build             # compiles src/ -> dist/
```

### Environment variables

`github_issues_manager/.env` — all optional, but strongly recommended:

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Personal access token. Without it you're limited to public repos and 60 requests/hour. A classic token with `repo` (or fine-grained *Issues: read*) is enough. |
| `GITHUB_DEFAULT_OWNER` | Owner used when the model doesn't provide one. |
| `GITHUB_DEFAULT_REPOSITORY` | Repository used when the model doesn't provide one. Must belong to `GITHUB_DEFAULT_OWNER`. |

`.env` files are git-ignored (only `.env.example` is tracked).

---

## Plugging a tool into LM Studio

1. **Build the server** so LM Studio has a plain JS entry point to run:

   ```bash
   cd github_issues_manager
   npm run build
   ```

2. **Open the MCP config** in LM Studio: right sidebar → **Program** → *Install* →
   **Edit `mcp.json`**. (The file lives at `~/.lmstudio/mcp.json`.)

3. **Register the server**, using an absolute path to the built file:

   ```json
   {
     "mcpServers": {
       "github_issues_manager": {
         "command": "node",
         "args": [
           "/Users/<you>/Documents/llm_tools/github_issues_manager/dist/index.js"
         ]
       }
     }
   }
   ```

   Add one entry per server as the collection grows. If you prefer running the
   TypeScript directly (no build step, slower start), use
   `"command": "npx"` with `"args": ["tsx", "/abs/path/src/index.ts"]`.

4. **Save.** LM Studio starts the server and the tool appears in the chat's plugin
   picker. Enable it there.

5. **Load a tool-capable model**, then ask something like:

   > *List the open issues of the default repository.*

   LM Studio shows a confirmation prompt before the first call — MCP tool calls are
   always user-approved.

### If it doesn't show up

- Check the path in `mcp.json` is absolute and that `dist/index.js` exists (`npm run build`).
- Check LM Studio's MCP logs (developer/console panel) — a crash on startup is usually a
  missing `npm install` or a malformed `.env`.
- Make sure the loaded model actually advertises tool support.
- Anything the server writes to stdout that isn't MCP protocol will break the transport,
  so keep debug logging on `stderr`.

---

## Local development & testing

Run the server against the official MCP Inspector to exercise tools without going
through LM Studio:

```bash
cd github_issues_manager
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Or start it directly (it will just wait for stdio traffic):

```bash
npm start
```

Rebuild with `npm run build` once the behaviour is satisfying, and restart the MCP
server from LM Studio to pick up the changes.

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
   (*"Do not ask for owner or repository"*) noticeably reduces useless clarifying
   questions from smaller local models.
5. Keep responses compact. Local models have small context windows; map away every field
   the model doesn't need.
6. Add a `.env.example`, build, and register it in `mcp.json`.
