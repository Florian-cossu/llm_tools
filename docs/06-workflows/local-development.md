---
type: workflow
status: active
scope: repo
last_reviewed: 2026-08-30
summary: Clone, install, configure, register and iterate - the day-to-day loop for working on a server.
read_when:
  - setting the repository up for the first time
  - starting work on a tool
code_refs:
  - package.json
  - scripts/setup-tools.mjs
tags:
  - workflow
  - setup
  - development
---

# Local development

## First-time setup

```bash
git clone <repo> llm_tools
cd llm_tools

bun install                            # every workspace in one pass
node scripts/setup-tools.mjs --write   # registers servers in ~/.lmstudio/mcp.json

cp tools/github/.env.example tools/github/.env
$EDITOR tools/github/.env              # fill in the values
```

Then restart the servers from the client. Requires **Bun 1.3+** and, for LM
Studio, **0.3.17+**.

Details: [setup and registration](../02-architecture/components/setup-and-registration.md).

## The inner loop

```
edit src/… ──► restart the server from the client ──► re-run the prompt
```

There is **no build step** — Bun runs TypeScript directly
([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md)). But the restart is not
optional: `.env`, tool descriptions and schemas are all fixed at startup
([execution lifecycle](../02-architecture/components/execution-lifecycle.md#what-is-fixed-at-initialisation)).

### Faster: the Inspector

Skip the client entirely while iterating on a tool:

```bash
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

It lists the registered tools, their schemas and descriptions, and lets you call
them with arbitrary arguments — showing the exact JSON the model would receive.
This is the right tool for anything except *"does the model choose correctly?"*,
which needs a real model and the [eval rubric](../05-harness/eval-rubric.md).

### Or start it bare

```bash
bun run start:github     # waits on stdio; ^C to stop
```

Useful only to check it starts without crashing.

## Common tasks

| Task | Route |
| --- | --- |
| Add a tool to a server | [tool contract](../04-contracts/tool-contract.md) → [tool package](../02-architecture/components/tool-package.md#adding-a-tool-to-an-existing-server) |
| Add a github tool | `node tools/github/scripts/add-new-implementation.mjs <name> --description "…"` |
| Create a server | `node scripts/create-tool.mjs <name> --description "…"` |
| Change a response shape | [data schemas](../04-contracts/data-schemas.md#changing-a-shape) |
| Add an env variable | [security and secrets](../04-contracts/security-and-secrets.md#adding-a-variable) |
| Re-register after a move | `node scripts/setup-tools.mjs --write` — paths are absolute |

## Before committing

```bash
git status --porcelain | grep -i '\.env$'   # must be empty
```

Then the checklist in [testing](testing.md). There is **no automated gate** — no
test suite, no type-check script
([harness overview](../05-harness/overview.md)), so the checklist is the gate.

## Conventions worth internalising

- **Never write to `stdout`** — it is the wire. `stderr` for everything else.
- **Restart after any `.env` or description change**, or you are testing the old
  process.
- **Descriptions are an interface**, not comments
  ([agent contract](../04-contracts/agent-contract.md)).
- **A tool absent from `TOOL_INSTANCES` does not exist.**
- **Never commit `.env`.**

## When something is wrong

→ [debugging](debugging.md) · [failure modes](../05-harness/failure-modes.md)
