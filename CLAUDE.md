# llm_tools

Local MCP servers, written in TypeScript and executed with Bun. Each server
under `tools/` is one integration, talks to the client over **stdio**, and is
**read-only**.

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
- Keep tools read-only. A write tool requires an ADR superseding ADR-0003.
- A tool absent from `TOOL_INSTANCES` does not exist.
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
bun install
bun run start:github               # server waits on stdio
node scripts/check-docs.mjs        # validate the docs vault
node scripts/setup-tools.mjs --write
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

> **`bun test` currently matches zero files** and exits successfully having run
> nothing. There is no test suite and no type-check step yet — see
> `docs/06-workflows/testing.md`. Validation is the manual checklist there.

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

- `list_github_milestones_by_repo` is registered but is still scaffold: it calls
  the *issue* endpoint. See `docs/07-plans/current.md`.
