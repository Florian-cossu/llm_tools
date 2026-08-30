# scripts

Zero-dependency Node scripts run from the repository root. Plain `.mjs` on purpose: the
orchestrator itself never needs installing or building.

| Script                                     | What it does                                        |
| ------------------------------------------ | --------------------------------------------------- |
| [setup-tools.mjs](setup-tools.mjs)         | Installs, builds and registers every server in LM Studio |
| [create-tool.mjs](create-tool.mjs)         | Scaffolds a new MCP server under `tools/`           |
| [check-docs.mjs](check-docs.mjs)           | Validates the `docs/` vault: frontmatter, links, code refs |

---

## `setup-tools.mjs`

Walks every tool directory, runs its setup step, then its build step, and prints an
`mcp.json` fragment covering all of them.

```bash
node scripts/setup-tools.mjs --write            # everything
node scripts/setup-tools.mjs --only github --write
node scripts/setup-tools.mjs --json-only > mcp.json
```

| Option           | Effect                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `--only <name>`  | Restrict to one tool directory. Repeatable.                                                   |
| `--dev`          | Emit the `dev` launch command from `tool.json` instead of `command` / `args`.                 |
| `--skip-install` | Don't run the setup step.                                                                     |
| `--skip-build`   | Don't run the build step.                                                                     |
| `--json-only`    | Print the fragment only — no setup, no build. Logs go to stderr, so this is pipeable.         |
| `--write`        | Merge into `~/.lmstudio/mcp.json`. The existing file is backed up, other servers preserved.   |
| `-h`, `--help`   | Show the help.                                                                                |

**How it finds tools.** Any directory under `tools/` containing a `tool.json` or a
`package.json` is a tool. `shared`, `scripts`, `node_modules` and `dist` are skipped, as
are dotted directories.

**How it resolves a step.** Most explicit source wins:

1. the `setup` / `build` string in `tool.json` (`null` means "no step");
2. an executable `setup.sh` / `build.sh` in the tool root;
3. `npm install` / `npm run build`, when a `package.json` justifies it.

**What it warns about.** A launch path that doesn't exist yet (usually a skipped or
failed build), and a tool that has a `.env.example` but no `.env`.

---

## `create-tool.mjs`

Scaffolds a working MCP server — it starts up and answers immediately, with one
`example_tool` to replace.

```bash
node scripts/create-tool.mjs linear --description "Linear issue tracker"
```

| Option                | Effect                                       |
| --------------------- | -------------------------------------------- |
| `--description "..."` | Short description, written into `package.json`. |
| `-h`, `--help`        | Show the help.                               |

The name is lowercased and non-alphanumerics become dashes; the script refuses to
overwrite an existing directory. It writes `package.json`, `tool.json`, `tsconfig.json`,
`.env.example` and `src/` (`index.ts`, `metadata.ts`, `server_instructions.ts`,
`toolbox/index.ts`, `toolbox/tools/example_tool.ts`).

It does **not** write a `README.md` — add one by hand, and a row in the root
[Available tools](../README.md#available-tools) table.

See [tools/README.md](../tools/README.md) for what to fill in next.

---

## Registering a server by hand

This is what `setup-tools.mjs --write` automates — useful to know when something
misbehaves.

1. In LM Studio: right sidebar → **Program** → _Install_ → **Edit `mcp.json`**
   (the file lives at `~/.lmstudio/mcp.json`).
2. Add the server, with `/abs/path` replaced by the absolute path to your clone:

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

3. Save. LM Studio starts the server and the tool appears in the chat's plugin picker.
4. Load a tool-capable model and ask for something the tool covers.

### If it doesn't show up

- Check the path is absolute and that `src/index.ts` exists.
- Check LM Studio's MCP logs — a crash on startup is usually a missing `.env` or a
  misconfigured variable.
- Make sure the loaded model actually advertises tool support.
- Anything a server writes to `stdout` that isn't MCP protocol breaks the transport —
  keep debug logging on `stderr`.

---

## `check-docs.mjs`

Validates the `docs/` Obsidian vault against
[docs/00-conventions.md](../docs/00-conventions.md). Exits non-zero on any
problem, so it works as a pre-commit or CI gate.

```bash
node scripts/check-docs.mjs
node scripts/check-docs.mjs --quiet   # errors only
```

It checks three things:

| Check | Catches |
| ----- | ------- |
| **Frontmatter** | Missing required fields; a `type`, `status` or `scope` outside the controlled vocabulary; a malformed `last_reviewed` date |
| **Links** | Broken relative links, links to a directory instead of its index note, anchors that match no heading, and wikilinks (`[[…]]`), which break outside Obsidian |
| **`code_refs`** | Frontmatter pointing at a file or directory that no longer exists — the doc↔code bridge going stale |

Links inside fenced blocks and code spans are ignored, since those are
illustrative rather than navigation. Anchors are resolved with GitHub's heading
slug rule.
