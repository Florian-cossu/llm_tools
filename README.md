# llm_tools

A personal collection of **local MCP servers** (Model Context Protocol) that add custom
tools to a local LLM runtime — primarily [LM Studio](https://lmstudio.ai), but any
MCP-compatible client (Claude Code, Claude Desktop, Cline, …) works.

Each server lives under `tools/`, is written in TypeScript, talks to the client over
**stdio** and runs entirely on your machine via [Bun](https://bun.sh): no proxy, no hosted
gateway, credentials stay in a local `.env`.

> **Heads up:** tool calling only works with models that support it. In LM Studio, look
> for the **tool use / function calling** badge on the model card (Qwen 3, Llama 3.x,
> Mistral, Gemma 4, …). A model without it silently ignores the tools.

---

## Available tools

| Tool                             | Version | Description                             | Tools exposed                                                                                       |
| -------------------------------- | ------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [github](tools/github/README.md) | 1.3.0   | GitHub issues and milestones, read-only | `list_github_issues`, `get_github_issue`, `get_github_milestone`, `list_github_milestones_by_repo`* |

\* work in progress — see the [github README](tools/github/README.md).

---

## Requirements

- **Bun 1.3+** — `curl -fsSL https://bun.sh/install | bash`
- **LM Studio 0.3.17+** (the release that introduced MCP support), or any other
  MCP-compatible client

---

## Getting started

```bash
git clone <this-repo> llm_tools
cd llm_tools

bun install                          # installs every workspace in one pass
node scripts/setup-tools.mjs --write # registers every server in ~/.lmstudio/mcp.json
```

Then give each server its credentials:

```bash
cp tools/github/.env.example tools/github/.env
# edit the file and fill in your values
```

`.env` files are git-ignored (only `.env.example` is tracked), so tokens never leave your
machine. Restart the servers from LM Studio after any change.

---

## Repository layout

```
llm_tools/
├── README.md          # you are here — catalogue + setup
├── package.json       # Bun workspace root
├── tsconfig.json      # shared TypeScript config
├── scripts/           # setup-tools.mjs, create-tool.mjs — see scripts/README.md
└── tools/             # one folder = one MCP server — see tools/README.md
    ├── shared/        # @llm-tools/shared, used by every server
    └── github/
```

- **[scripts/README.md](scripts/README.md)** — the setup and scaffolding scripts, their
  flags, and how to register a server by hand when something misbehaves.
- **[tools/README.md](tools/README.md)** — the anatomy of a server, the `tool.json`
  manifest, the shared package and the conventions for writing tools local models
  actually call correctly.

---

## Adding a new tool

```bash
node scripts/create-tool.mjs <tool-name> --description "What it does"
```

This scaffolds a working server under `tools/<tool-name>/`. See
[tools/README.md](tools/README.md) for what to do next.

---

## Local development

Run any server against the official MCP Inspector, without going through LM Studio:

```bash
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

Or start it directly — it waits for stdio traffic:

```bash
bun run start:github
```

No build step: Bun runs TypeScript directly. After changing a tool, restart its server
from LM Studio to pick up the changes.
