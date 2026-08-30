---
type: contract
status: active
scope: mcp
last_reviewed: 2026-08-30
summary: What a single tool must implement - naming, schema, defaults, response shape, errors and description quality.
read_when:
  - adding or changing any tool
  - reviewing a tool before it is registered
code_refs:
  - tools/github/src/toolbox/tools/list_github_issues_by_repo.ts
  - tools/github/src/toolbox/index.ts
tags:
  - contract
  - tool
  - mcp
---

# Tool contract

Binding on every file in `src/toolbox/tools/`. Server-level rules:
[MCP server contract](mcp-server-contract.md).

## Structure

```ts
export const TOOL_NAME = "get_github_issue";

export const getGithubIssue: ToolInstance = (server, config) => {
  server.registerTool(TOOL_NAME, { description, inputSchema }, handler);
};
```

| # | Requirement |
| --- | --- |
| T1 | Exports a `ToolInstance` — `(server, config) => void` |
| T2 | Exports `TOOL_NAME`, and uses it in registration *and* in error messages |
| T3 | Listed in `TOOL_INSTANCES`. **A tool absent from that list does not exist** |
| T4 | One tool per file |

## Naming

- `snake_case`, `verb_noun`: `list_github_issues`, `get_github_issue`.
- **Globally unique across every server.** The model sees one flat list, so the
  integration goes in the name — `list_issues` is not acceptable, even though it
  lives in the github server
  ([ADR-0004](../03-decisions/ADR-0004-server-per-integration.md)).
- `list_*` returns many, without expensive fields. `get_*` returns one, in full.
- The public name is `TOOL_NAME`, not the filename — they may differ, as with
  `list_github_issues` in `list_github_issues_by_repo.ts`.

## Input schema

| # | Requirement |
| --- | --- |
| T5 | A zod object. Every parameter has `.describe()` |
| T6 | Static defaults via `.default()`, sourced from `metadata.ts` where server-level |
| T7 | Bounded numbers: `.int()`, `.min()`, `.max()` |
| T8 | Closed sets are `z.enum([...])`, never a free string |
| T9 | A parameter with a configured fallback uses `optionalWhenConfigured(...)` — required in the schema exactly when it is required in prose |

## Defaults from `.env`

Two mechanisms, not to be confused
([data flows](../02-architecture/data-flows.md#where-each-concern-is-applied)):

| Kind | Applied by | Example |
| --- | --- | --- |
| Static | zod `.default()` at validation | `state`, `limit`, `sortBy` |
| Configured | The handler, from `ServerConfig` | `owner`, `repository` |

Configured defaults resolve with one idiom, and fail with one message:

```ts
const effectiveOwner = owner?.trim() || config.defaultOwner;
if (!isStringUsable(effectiveOwner) || !isStringUsable(effectiveRepository)) {
  throw new Error(
    "No GitHub owner or repository was provided, and no default was configured.",
  );
}
```

`||` not `??` — an empty string must fall through to the default.

## Descriptions

The description is an interface, not a comment: it is the model's main signal.

| # | Requirement |
| --- | --- |
| T10 | Prefixed with `describeConfiguredRepository(...)` when the server has repo defaults |
| T11 | States **what the tool returns**, field by field, inline in the prose |
| T12 | Names the tool to use next, when this one is a step (`list_*` → `get_*`) |
| T13 | States what it does **not** return (bodies, comments, pull requests) |
| T14 | States relevant limits (rate limits, single-page) as *guidance to the model* |
| T15 | Written for a model, not a human — imperative, explicit, no cross-references it cannot follow |

A configured default must be announced in **three** places, because each is read
at a different moment — see the
[three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule).
`list_github_issues` is the reference implementation.

## Responses

| # | Requirement |
| --- | --- |
| T16 | `{ content: [{ type: "text", text: JSON.stringify(payload) }] }` |
| T17 | The payload is a **compact shape** from `mappers/`, never a raw API response |
| T18 | Lists return an envelope: `{ totalCount, returned, …, items }` — see the exception below |
| T19 | Truncation is signalled, not hidden — `totalCount ≠ returned`, or an explicit flag |
| T20 | No pagination cursors. Raise `limit` instead |
| T21 | `list_*` omits expensive fields (bodies); `get_*` includes them |

Shapes: [data schemas](data-schemas.md).

> [!note] When the endpoint has no total
> T18 assumes the upstream API reports one. `list_github_milestones_by_repo`
> calls a REST list endpoint that does not, so it emits
> `{ returned, truncated, milestones }`. T19 is what actually matters — a
> `totalCount` copied from `returned` would satisfy T18 while hiding truncation
> entirely. **A list with no honest total carries a boolean `truncated`
> instead.** Rationale:
> [github server](../02-architecture/components/github-server.md#no-totalcount-on-the-milestone-list).

## Errors

| # | Requirement |
| --- | --- |
| T22 | `throw` — do not return an error-shaped success payload |
| T23 | Every external call has `.catch()` wrapping the cause with context |
| T24 | Messages name the tool or the operation, and the offending value |
| T25 | No credential, no raw HTTP dump in a message |

```ts
.catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(`Unable to retrieve issue "${number}": ${reason}`);
});
```

Catalogue: [failure modes](../05-harness/failure-modes.md).

## MUST NOT

- Call a mutating endpoint ([ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md)).
- Write to `stdout`.
- Reshape a payload inline — that is a mapper's job.
- Read `process.env` directly. Use `config`.
- Hold state between calls.
- Ship registered while still scaffold. `list_github_milestones_by_repo` did
  exactly this and stayed callable-but-wrong until it was finished — the
  cautionary case, not an open defect.

## Review checklist

- [ ] T1–T4 structure · [ ] T5–T9 schema · [ ] T10–T15 description
- [ ] T16–T21 response · [ ] T22–T25 errors
- [ ] Read-only endpoint
- [ ] Documented in the server README
- [ ] No `TODO` left from the scaffold
- [ ] Exercised through the MCP Inspector ([local development](../06-workflows/local-development.md))
