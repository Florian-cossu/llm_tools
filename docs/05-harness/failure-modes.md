---
type: harness
status: active
scope: repo
last_reviewed: 2026-09-01
last_updated: 2026-09-01
summary: Catalogue of how these servers fail - startup, protocol, model-behaviour and API errors - with symptom, cause and fix.
read_when:
  - something is broken and you need to identify which layer
  - writing an error message for a new tool
  - deciding what a test should cover
code_refs:
  - tools/github/src/toolbox/tools/
  - tools/github/src/index.ts
tags:
  - harness
  - errors
  - troubleshooting
---

# Failure modes

Grouped by layer, because the layer determines where to look. Step-by-step
diagnosis: [debugging](../06-workflows/debugging.md).

## 1. Startup — the server never runs

Worst class: there is **no error channel yet**, since the transport is not
connected. Visible only in the client's MCP logs.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Server absent from the client | Relative path in `mcp.json` | Absolute paths — `setup-tools.mjs --write` does this |
| Server absent | `bun` not on the client's `PATH` | Absolute path to the `bun` binary in `command` |
| Immediate exit | Throw at module top level | Never throw for a missing credential — S9, [server contract](../04-contracts/mcp-server-contract.md) |
| Immediate exit | Syntax/type error — Bun strips types, it does not check them | `bun run typecheck` before starting; [ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md#consequences) |
| Starts, every call fails | `.env` missing or empty | Copy `.env.example`, fill, **restart** |

## 2. Protocol — the transport breaks

| Symptom | Cause | Fix |
| --- | --- | --- |
| Client drops the server; garbled JSON-RPC | Something wrote to `stdout` | Move to `stderr`. Check `console.log`, and `dotenv` without `quiet: true` |
| Intermittent corruption | A dependency logging to `stdout` | Silence it at construction |

**The single most common self-inflicted failure in this repo.** See
[constraints](../01-context/constraints.md#transport).

## 3. Model behaviour — everything healthy, nothing works

No error is raised. This is the class the
[agent contract](../04-contracts/agent-contract.md) exists to prevent.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Tools never called | Model lacks tool-calling support | Load a tool-capable model — **no error is produced** |
| Tools never called | Server not enabled in the chat | Enable it in the client's picker |
| Model asks "which repository?" | Default missing from one of the [three places](../02-architecture/components/shared-package.md#the-three-places-rule) | Add the missing surface |
| Model asks for values just configured | Server not restarted — schemas fixed at startup | Restart ([lifecycle](../02-architecture/components/execution-lifecycle.md)) |
| Wrong tool chosen | Descriptions do not distinguish them | State what each returns *and does not* |
| Reports a truncated page as a total | Envelope ignored | Explain `totalCount` vs `returned` |
| Says an issue has no description | `list_*` returns no bodies | Say so, and point at `get_github_issue` |
| Asks permission before reading | Read-only never stated | Re-enable the commented-out paragraph in `server_instructions.ts` |

## 4. Tool execution — the call fails

Thrown, surfaced to the model as an error result.

| Message | Cause | Model should |
| --- | --- | --- |
| `No GitHub owner or repository was provided, and no default was configured.` | Both param and `.env` default unusable | Ask the user, or pass explicitly |
| `Unable to retrieve issue "N": Not Found` | Wrong number, wrong repo, or no token for a private repo | Verify via `list_github_issues` |
| `GitHub rejected the search "…": Validation Failed` | Malformed qualifier | Simplify the query |
| `… API rate limit exceeded` | ~30/min search budget spent | Wait; make fewer, narrower calls |
| `… Bad credentials` | Invalid or expired token | Rotate, restart |
| Milestone number treated as an issue number | The two sequences are unrelated; a valid issue number is often an invalid milestone number | 404 from `issues.getMilestone`, surfaced as `Unable to retrieve milestone "N"` |

### HTTP status → meaning

| Status | Meaning here |
| --- | --- |
| 401 | Invalid/expired token |
| 403 | Rate limit, or token lacks scope |
| 404 | Absent **or** invisible to this token — GitHub does not distinguish |
| 422 | Malformed search query |
| 5xx | GitHub-side; retry later |

## 5. Data — the call succeeds, the answer is wrong

The quietest class. Caught only by tests that do not exist yet
([overview](overview.md)).

| Symptom | Cause |
| --- | --- |
| Assignees missing | Search omits the field entirely when unassigned; mapper must `?? []` |
| A label vanishes | Nameless label, filtered by `isStringUsable` — correct, worth knowing |
| Pull requests in results | `is:issue` missing from the query |
| Closed issues absent when `state: "all"` | `state:all` emitted as a qualifier — it is not valid GitHub syntax |
| `undefined` fields lost in transit | `JSON.stringify` drops them — use `null` |

Details: [github API quirks](../04-contracts/github-api.md#quirks-that-have-bitten).

## Writing a good failure

A message is read by a **model**, which will act on it. It must name the
operation, the offending value, and the cause — and never a credential.

```ts
throw new Error(`Unable to retrieve issue "${number}": ${reason}`);
```

Rules: T22–T25 in the [tool contract](../04-contracts/tool-contract.md#errors).
