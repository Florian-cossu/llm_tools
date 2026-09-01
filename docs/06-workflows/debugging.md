---
type: workflow
status: active
scope: repo
last_reviewed: 2026-09-01
summary: Ordered diagnosis - is the server running, is the transport intact, is the model calling, is the call correct.
read_when:
  - a server does not appear in the client
  - the model ignores the tools
  - a tool call fails or returns something wrong
code_refs:
  - tools/github/src/index.ts
tags:
  - workflow
  - debugging
  - troubleshooting
---

# Debugging

Work the layers in order. Each step tells you whether to stop or descend.
Symptom catalogue: [failure modes](../05-harness/failure-modes.md).

---

## Step 0 — Did you restart?

**Ask this first, every time.** `.env` values, tool descriptions and input
schemas are all fixed at process start
([execution lifecycle](../02-architecture/components/execution-lifecycle.md#what-is-fixed-at-initialisation)).
Editing a file changes nothing in the running server.

Restart from the client, then reproduce. This resolves a large share of
"it didn't work".

---

## Step 1 — Does the process start?

```bash
bun run tools/github/src/index.ts
```

It should print **nothing** and hang, waiting on stdio. That is success.

| Observed | Meaning |
| --- | --- |
| Hangs silently | ✅ Descend to step 2 |
| Exits immediately | Throw at module top level, or a syntax/type error |
| Prints anything to stdout | **Transport bug** — see step 3 |
| Exits complaining about credentials | Contract violation: a missing credential must not crash startup (S9) |

Bun strips types rather than checking them
([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md#consequences)), so a type
error surfaces here or at call time unless `bun run typecheck` was run first.
Run it now — it is a couple of seconds and rules the whole class out.

---

## Step 2 — Does the client see it?

```bash
npx @modelcontextprotocol/inspector bun run tools/github/src/index.ts
```

Check: the handshake reports the expected name and version; every tool appears
under its **public** name; instructions appear and mention your configured
defaults.

| Observed | Fix |
| --- | --- |
| Tool missing | Not in `TOOL_INSTANCES` |
| Wrong name | `TOOL_NAME` ≠ what you expected — the filename is irrelevant |
| Instructions empty | `.env` defaults unset, or server not restarted |
| Defaults absent from instructions | `stringOrNull` returned `null` — check for an empty `GITHUB_DEFAULT_OWNER=` |

If the Inspector works but the client does not, the problem is registration:

- Path in `mcp.json` **absolute**? Relative paths never resolve — the client
  spawns with no shell.
- `bun` on the client's `PATH`? Use an absolute path to the binary if unsure.
- Re-run `node scripts/setup-tools.mjs --only <name> --write`.
- Read the client's MCP log — a startup crash appears **only** there, since the
  transport is not yet connected.

---

## Step 3 — Is the transport intact?

Symptoms: the client drops the server mid-session; garbled JSON-RPC; the server
appears then vanishes.

Cause is almost always **something wrote to `stdout`**.

```bash
grep -rn "console\.log\|process\.stdout\.write" tools/*/src/
```

Also check every `dotenv.config(...)` has `quiet: true`, and that no new
dependency logs on construction. See
[observability](../05-harness/observability.md).

---

## Step 4 — Is the model calling the tool?

Everything is healthy and nothing happens. **No error is produced** in this
class.

| Check | Fix |
| --- | --- |
| Does the model support tool calling? | Look for the tool-use badge on the model card. A model without it silently ignores every tool |
| Is the server enabled in this chat? | Enable it in the client's picker |
| Is the description clear about *when* to use it? | [agent contract](../04-contracts/agent-contract.md) |

If it asks for the repository instead of calling: a default is missing from one
of the [three places](../02-architecture/components/shared-package.md#the-three-places-rule).
Verify in the Inspector that the description contains the **literal configured
value**, and that `owner` is optional in the schema. If it does not, you are
looking at a process started before the value was set — step 0.

---

## Step 5 — Is the call correct?

Call it directly in the Inspector with the exact arguments the model used.

| Symptom | Look at |
| --- | --- |
| `Not Found` | Number, repository, and token visibility — GitHub returns 404 for both absent and invisible |
| `Validation Failed` | The query string from `buildIssueSearchQuery` — log it to `stderr` |
| `rate limit exceeded` | ~30/min search budget — [github API](../04-contracts/github-api.md#rate-limits) |
| `Bad credentials` | Token invalid or expired. Rotate, **restart** |
| Missing assignees | Mapper normalisation — [data schemas](../04-contracts/data-schemas.md) |
| A valid schema rejected, or `instanceof` failing on a zod type | Two copies of `zod`. Run `bun run check:deps`, then `bun run deps:reset` — [ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever) |
| Pull requests present | `is:issue` missing from the query |
| Closed issues absent with `state: "all"` | `state:all` emitted as a qualifier — it is not valid GitHub syntax |
| Milestone or label list has no `totalCount` | Expected — those endpoints report no total; check `truncated` instead ([github api](../04-contracts/github-api.md#listing-milestones)) |
| `get_github_milestone` says "not found" for a number you can see | Milestone numbers are **not** issue numbers; get the number from `list_github_milestones_by_repo` |

---

## Quick reference

```bash
bun run tools/github/src/index.ts                     # 1. does it start?
npx @modelcontextprotocol/inspector bun run …/index.ts # 2. what does the client see?
grep -rn "console\.log" tools/*/src/                   # 3. transport intact?
node scripts/setup-tools.mjs --only github --write     # re-register
git check-ignore -v tools/github/.env                  # env still ignored?
```
