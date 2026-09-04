# llm_tools

Local MCP servers, written in TypeScript and executed with Bun. Each server
under `tools/` is one integration and talks to the client over **stdio**. Tools
are **read-only by default**: a mutating tool must declare
`TOOL_EFFECT = "write"` and is registered only when the server's write flag is
set (ADR-0007).

## Before making changes

1. Read `docs/00-index.md` and follow its **Route by task** table — it names the
   notes for your specific task.
2. Read the README of the affected server under `tools/`.
3. Read the relevant contract in `docs/04-contracts/`.
4. Check `docs/03-decisions/` for an existing ADR.
5. Validate with the checklist in `docs/06-workflows/testing.md`.

Every doc carries frontmatter — `type`, `status`, `scope`, `summary`,
`read_when`, `code_refs`. Use `read_when` to decide what to open and `status` to
decide whether to trust it. Schema: `docs/00-conventions.md`.

> **`status: planned` means it does not exist.** Several notes under
> `docs/05-harness/` and `docs/06-workflows/` describe intent. Never report
> planned behaviour as implemented.

## Repository rules

- Keep MCP servers local and stdio-based unless an ADR says otherwise.
- **Never write to `stdout`** — it is the JSON-RPC channel. Diagnostics go to
  `stderr`.
- **Restart the server after any change.** `.env`, tool descriptions and input
  schemas are all fixed at process start.
- Do not commit credentials, tokens, customer data, or production responses.
  Fixtures are synthetic.
- Every tool declares `TOOL_EFFECT`: `read`, `write` or `destructive`. `read` is
  the default and is binding — a `read` tool calling a mutating endpoint is a
  defect. **No `destructive` tool may be registered yet** (ADR-0007).
- A tool absent from `TOOL_REGISTRATIONS` does not exist — and one whose effect
  the config disallows is dropped at startup even though it is listed. The
  reason goes to `stderr`.
- Gate writes at **registration**, never inside a handler.
- Every new MCP tool must have:
  - a clear description, written for a model rather than a human,
  - validated input parameters,
  - predictable, compact output built by a mapper,
  - documented error behavior,
  - at least one representative test or fixture.
- Tool and parameter descriptions are an **interface**, not comments — see
  `docs/04-contracts/agent-contract.md`.
- Do not modify generated files under `docs/90-generated/` manually.
- Do not treat `docs/07-plans/` or `docs/99-archive/` as authoritative.

## Commands

```bash
bun install                        # run at the ROOT — deps live there (ADR-0005)
bun add <pkg>                      # also at the root, never in tools/<name>/
bun run start:github               # server waits on stdio
GITHUB_ALLOW_WRITES=true bun run start:github   # ... with write tools too
bun run test                       # docs + clean install + typecheck + dependency layout
bun run typecheck                  # tsc --noEmit over every workspace
bun run check:docs                 # validate the docs vault
bun run check:deps                 # one declaration site, one copy of each
bun run deps:reset                 # nuke node_modules AND bun.lock, reinstall
bun run setup                      # = node scripts/setup-tools.mjs --write
bun run migrate                    # apply data/migrations/*.sql to data/harness.db
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

> **`bun run deps:reset` deletes `bun.lock`**, re-resolving every transitive
> range. Deliberate act, not part of the loop — use it when `check:deps`
> reports a duplicate, then confirm the server still starts.

> **`bun run test` and `bun test` are different commands.** `bun run test` runs
> the root `test` script — a clean reinstall, `check-docs.mjs`, `bun run
> typecheck` and `check-deps.mjs` — and does real work. **`bun test`, the test
> runner, still matches zero files** and exits successfully having verified
> nothing. There is no unit-test suite yet — see `docs/06-workflows/testing.md`.
> Validation is the manual checklist there. Run `bun run setup` before
> `bun run test`.

> **The typecheck must be the real `tsc`.** The deprecated `tsc` npm package
> prints a notice and **exits 0**. `bun run typecheck` resolves `tsc` from the
> `typescript` devDependency; never call `npx tsc` in a script.

## Documentation map

| Path | Holds | Authoritative |
| --- | --- | --- |
| `docs/00-index.md` | Task-based routing | entry point |
| `docs/00-conventions.md` | Frontmatter schema, linking rules | yes |
| `docs/01-context/` | Purpose, goals, constraints, glossary | yes |
| `docs/02-architecture/` | How the pieces fit | yes, code wins |
| `docs/03-decisions/` | ADRs — the rationale | **yes** |
| `docs/04-contracts/` | MCP, tool, agent, schema, security contracts | **yes** |
| `docs/05-harness/` | Testing, evals, observability | mostly **planned** |
| `docs/06-workflows/` | Setup, debugging, validation | yes |
| `docs/07-plans/` | Work in progress | **no** |
| `docs/99-archive/` | Superseded material | **no** |

Source of truth, highest first: code → contracts → decisions → architecture →
workflows.

## Known broken

- **`delete_github_label` declares `write` while calling `issues.deleteLabel`.**
  ADR-0007 D3 names that exact case `destructive`, and no `destructive` tool may
  be registered yet — but the gate reads the declaration, so the tool registers
  whenever `GITHUB_ALLOW_WRITES` is set. It is also missing from the github
  server's README tool table (D6). The github server lists nine tools at v2.4.0,
  a version the docs describe as eight.
- The permission layer ADR-0007 points at (SQLite, per-tool, consulted before
  execution) is **still not built**. Its *storage* now exists —
  `bun run migrate` creates `data/harness.db` with one `github_mcp` row per
  tool, holding `allow`/`deny`/`ask` and defaulting to `deny` — but **nothing
  reads it**, so the `.env` flag remains the whole gate. A seeded table is not
  a permission layer.

  See `docs/07-plans/current.md`.

## Data store

A local SQLite database under `data/`, applied by a migration runner that reads
plaintext `.sql` files in filename order and records each in a `meta` table.

- `bun run migrate` is safe to re-run; a second run applies nothing.
- **Never edit an applied migration** — it will not run again. Add the next one.
- `harness.db` and its `-wal`/`-shm` siblings are gitignored. Never commit them.
- Adding a tool does not add its permission row; that needs a migration.

See `docs/02-architecture/components/data-store.md`.
