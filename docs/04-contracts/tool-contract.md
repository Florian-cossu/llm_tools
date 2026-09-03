---
type: contract
status: active
scope: mcp
last_reviewed: 2026-09-02
last_updated: 2026-09-03
summary: What a single tool must implement - naming, schema, defaults, response shape, errors and description quality.
read_when:
  - adding or changing any tool
  - reviewing a tool before it is registered
code_refs:
  - tools/github/src/toolbox/tools/list_github_issues.ts
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
export const TOOL_EFFECT: ToolEffect = "read";

const register: ToolInstance = (server, config) => {
  server.registerTool(TOOL_NAME, { description, inputSchema }, handler);
};

export const getGithubIssue: ToolRegistration = {
  name: TOOL_NAME,
  effect: TOOL_EFFECT,
  register: register,
};
```

| # | Requirement |
| --- | --- |
| T1 | Exports a `ToolRegistration` — `{ name, effect, register }`, whose `register` is a `ToolInstance`: `(server, config) => void` |
| T2 | Exports `TOOL_NAME`, and uses it in registration *and* in error messages |
| T3 | Listed in `TOOL_REGISTRATIONS`. **A tool absent from that list does not exist** — though being listed is necessary, not sufficient, see [effect class](#effect-class-and-writes) |
| T4 | One tool per file |
| T4b | Exports `TOOL_EFFECT`, and the registration carries it — never a literal inline, so the file states what it does in one place |

## Effect class and writes

Every tool declares what calling it does upstream
([ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)):
`read`, `write` or `destructive`. The declaration is data, not a comment — the
registration gate reads it at startup, `describeMutation` reads it to open the
description, and the permission layer will read it to decide.

| # | Requirement |
| --- | --- |
| T4c | `read` is the default, and it must be true. **A tool declaring `read` and calling a mutating endpoint is a defect** |
| T4d | `destructive` is not registrable yet. Do not ship one |
| T4e | A `write` tool opens its description with `describeMutation(TOOL_EFFECT)` rather than improvising a warning |
| T4f | A `write` tool is idempotent, or fails on the second call. It never silently applies twice |
| T4g | A `write` tool returns the result **read back from the API**, mapped, never an echo of its own input |
| T4h | A `write` tool is documented as a write in the server README and the root tool table |

A write tool needs no per-call guard: it is not registered at all unless the
server's configuration allows writes, so an unauthorised model never sees it.
That gate lives in the server's `index.ts` — see
[execution lifecycle](../02-architecture/components/execution-lifecycle.md#what-is-fixed-at-initialisation).

## Naming

- `snake_case`, `verb_noun`: `list_github_issues`, `get_github_issue`.
- **Globally unique across every server.** The model sees one flat list, so the
  integration goes in the name — `list_issues` is not acceptable, even though it
  lives in the github server
  ([ADR-0004](../03-decisions/ADR-0004-server-per-integration.md)).
- `list_*` returns many, without expensive fields. `get_*` returns one, in full.
- The public name is `TOOL_NAME`, not the filename. Nothing enforces the match,
  so a tool is identified by its `TOOL_NAME` and never by the file it lives in —
  but name the file after the tool, as every one of them does today.

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

| #   | Requirement                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T16 | `{ content: [{ type: "text", text: JSON.stringify(payload) }] }`                                                                                    |
| T17 | The payload is a **compact shape** from `mappers/`, never a raw API response — see [ADR-0006](../03-decisions/ADR-0006-frugal-output-by-default.md) |
| T18 | Lists return an envelope: `{ totalCount, returned, …, items }` — see the exception below                                                            |
| T19 | Truncation is signalled, not hidden — `totalCount ≠ returned`, or an explicit flag                                                                  |
| T20 | No pagination cursors. Raise `limit` instead                                                                                                        |
| T21 | `list_*` omits expensive fields (bodies); `get_*` includes them                                                                                     |

Shapes: [data schemas](data-schemas.md).

> [!note] When the endpoint has no total
> T18 assumes the upstream API reports one. `list_github_milestones` and
> `list_github_labels` call plain REST list endpoints that do not, so they emit
> `{ returned, truncated, milestones }` and `{ returned, truncated, labels }`.
> T19 is what actually matters — a `totalCount` copied from `returned` would
> satisfy T18 while hiding truncation entirely. **A list with no honest total carries a boolean `truncated`
> instead.** Rationale:
> [github server](../02-architecture/components/github-server.md#no-totalcount-on-the-plain-listings).

> [!note] When the detail *is* the list row
> T21 assumes the upstream detail endpoint returns more than the list does.
> `GET /repos/{owner}/{repo}/labels/{name}` does not — it returns exactly one
> row of `GET /repos/{owner}/{repo}/labels`, and the compact shape already keeps
> all of it. `get_github_label` therefore returns the same shape as
> `list_github_labels` and earns its registration on **cost and certainty**
> instead: one label rather than a hundred, and a 404 that answers "does this
> label exist?". The rule T21 protects is *a `get_*` must not be dead weight*;
> that is the test to apply. **Reach for this exception only when the endpoint
> genuinely has nothing more to give** — `get_github_milestone` looked like this
> case and was not, and shipped returning the list row until `openIssues` and
> `closedIssues` were added. Rationale:
> [github server](../02-architecture/components/github-server.md#get_github_label-returns-no-more-than-the-list).

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

- Call a mutating endpoint from a tool declaring `read`
  ([ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)).
  Writes are allowed; undeclared ones are not.
- Write to `stdout`.
- Reshape a payload inline — that is a mapper's job.
- Read `process.env` directly. Use `config`.
- Hold state between calls.
- Ship registered while still scaffold. `list_github_milestones` did
  exactly this and stayed callable-but-wrong until it was finished — the
  cautionary case, not an open defect.
- Return a field a model cannot act on. Every mapper field must be
  justified — [ADR-0006](../03-decisions/ADR-0006-frugal-output-by-default.md).

## Review checklist

- [ ] T1–T4 structure · [ ] T4b–T4h effect class · [ ] T5–T9 schema
- [ ] T10–T15 description · [ ] T16–T21 response · [ ] T22–T25 errors
- [ ] The endpoint matches the declared effect
- [ ] Documented in the server README
- [ ] No `TODO` left from the scaffold
- [ ] Exercised through the MCP Inspector ([local development](../06-workflows/local-development.md))
