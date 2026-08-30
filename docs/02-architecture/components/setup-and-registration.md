---
type: component
status: active
scope: scripts
last_reviewed: 2026-08-30
summary: How setup-tools.mjs discovers, installs and registers servers into the client's mcp.json, and how to do it by hand.
read_when:
  - registering a server with LM Studio or another client
  - a server does not appear in the client
  - changing the orchestration scripts
code_refs:
  - scripts/setup-tools.mjs
  - scripts/create-tool.mjs
  - tools/github/tool.json
tags:
  - component
  - scripts
  - setup
---

# Setup and registration

[`scripts/setup-tools.mjs`](../../../scripts/setup-tools.mjs) walks every server,
runs its setup and build steps, and emits an `mcp.json` fragment covering all of
them.

Prose version with full flag docs: [`scripts/README.md`](../../../scripts/README.md).

## Why plain `.mjs`

Zero dependencies, run by Node, **not** Bun. The orchestrator has to work before
`bun install` has ever run in this clone — so it cannot itself require
installing or building. And nothing in it is Node-specific by design: a server
declares how it installs and launches in its own
[`tool.json`](tool-package.md#tooljson), so a Python or Go MCP server drops in
without touching the script.

## Usage

```bash
node scripts/setup-tools.mjs --write             # everything
node scripts/setup-tools.mjs --only github --write
node scripts/setup-tools.mjs --json-only > mcp.json
```

| Flag | Effect |
| --- | --- |
| `--only <name>` | Restrict to one server. Repeatable |
| `--dev` | Emit `tool.json`'s `dev` command instead of `command`/`args` |
| `--skip-install` / `--skip-build` | Skip that step |
| `--json-only` | Fragment only, no setup or build. Implies both skips |
| `--write` | Merge into `~/.lmstudio/mcp.json`, backing up the existing file |
| `-h`, `--help` | Help |

Logs go to `stderr`, so `--json-only` is safely pipeable — the same discipline
the servers themselves follow, for the same reason.

## Discovery

Any directory under `tools/` containing a `tool.json` **or** a `package.json`.
Skipped: `shared`, `scripts`, `node_modules`, `dist`, and anything dotted. This
is why `tools/shared/` is never registered as a server despite having a
`package.json`.

## Step resolution

Most explicit source wins, for both setup and build:

1. the `setup` / `build` string in `tool.json` — **`null` means "no step"**;
2. an executable `setup.sh` / `build.sh` in the server root;
3. `npm install` / `npm run build`, when a `package.json` justifies it.

The github server sets `"build": null` — there is no build step, per
[ADR-0002](../../03-decisions/ADR-0002-bun-workspaces.md).

## Path absolutisation

Any value in `args` containing a `/` is rewritten to an absolute path. This is
the single most important behaviour of the script: the client spawns servers
with **no shell and no useful working directory**, so a relative
`src/index.ts` in `mcp.json` never resolves. See
[execution lifecycle](execution-lifecycle.md#phases).

## Warnings

The script warns rather than fails on:

- a launch path that does not exist yet — usually a skipped or failed build;
- a server with a `.env.example` but no `.env` — it will start and then fail
  every call for want of credentials.

## Registering by hand

What `--write` automates:

1. LM Studio → right sidebar → **Program** → *Install* → **Edit `mcp.json`**
   (`~/.lmstudio/mcp.json`).
2. Add the entry, with an **absolute** path:

   ```json
   {
     "mcpServers": {
       "github": {
         "command": "bun",
         "args": ["run", "/abs/path/llm_tools/tools/github/src/index.ts"]
       }
     }
   }
   ```

3. Save — the client starts the server and the tool appears in the picker.
4. Load a **tool-capable** model.

## Scaffolding

[`create-tool.mjs`](../../../scripts/create-tool.mjs) creates a new server
folder that starts and answers immediately, with one `example_tool` to replace:

```bash
node scripts/create-tool.mjs linear --description "Linear issue tracker"
```

It refuses to overwrite an existing directory, and does **not** write a
`README.md` or add the root catalogue row — both manual. See
[tool package](tool-package.md#scaffolding-a-server).

## If a server doesn't appear

→ [Debugging](../../06-workflows/debugging.md), which covers this end to end.
