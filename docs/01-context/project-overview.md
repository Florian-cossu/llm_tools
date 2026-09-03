---
type: context
status: active
scope: repo
last_reviewed: 2026-09-02
last_updated: 2026-09-03
summary: llm_tools is a personal collection of local, stdio-based MCP servers that give a local LLM custom tools.
read_when:
  - you are new to this repository
  - you need to explain what this project is or is not
code_refs:
  - README.md
  - package.json
tags:
  - context
  - overview
---

# Project overview

**llm_tools** is a personal collection of **local MCP servers** — small
TypeScript programs that expose custom tools to an LLM runtime over the
[Model Context Protocol](glossary.md#mcp).

The primary client is [LM Studio](https://lmstudio.ai), but any MCP-compatible
client works: Claude Code, Claude Desktop, Cline.

## The shape of it

Each server lives in its own folder under `tools/`, is written in TypeScript,
runs on [Bun](https://bun.sh) with **no build step**, and talks to the client
over **stdio**. Nothing is hosted, nothing is proxied, credentials never leave
the machine — they sit in a git-ignored `.env` next to the server.

```
llm_tools/
├── docs/       ← this vault
├── scripts/    ← setup + scaffolding orchestration
└── tools/
    ├── shared/ ← @llm-tools/shared, imported by every server
    └── github/ ← one folder = one MCP server
```

See [system overview](../02-architecture/system-overview.md) for how these
interact, and [tool package](../02-architecture/components/tool-package.md) for
the anatomy of a single server.

## What ships today

| Server | Version | Access | Tools |
| --- | --- | --- | --- |
| [github](../02-architecture/components/github-server.md) | 2.4.0 | Read + two gated writes | `list_github_issues`, `get_github_issue`, `get_github_milestone`, `list_github_milestones`, `list_github_labels`, `get_github_label`, `create_github_label` **(write)**, `update_github_label` **(write)** |

## The problem it actually solves

The constraint that shapes almost every decision here is **the local model**,
not the API. A local model has a small context window and reads a tool
description more carefully than it reads a JSON schema. So:

- responses are **mapped down to compact shapes** before the model sees them —
  the full GitHub payload would eat the window ([data schemas](../04-contracts/data-schemas.md));
- list and detail are **separate tools**, so listing issues doesn't drag in
  every body;
- defaults configured in `.env` are **restated in prose** inside tool
  descriptions and server instructions, or the model asks the user for values
  the server already holds ([agent contract](../04-contracts/agent-contract.md)).

That last point is why [`@llm-tools/shared`](../02-architecture/components/shared-package.md)
exists at all.

## Next

- [Goals and non-goals](goals-and-nongoals.md) — what this is deliberately not.
- [Constraints](constraints.md) — the fixed limits to design within.
- [Glossary](glossary.md) — the vocabulary used throughout this vault.
