---
type: architecture
status: active
scope: repo
last_reviewed: 2026-09-01
last_updated: 2026-09-01
summary: The path a request takes from user prompt to compact JSON, and where each transformation happens.
read_when:
  - tracing why a tool returned what it did
  - adding a step that transforms a request or response
code_refs:
  - tools/github/src/toolbox/tools/list_github_issues.ts
  - tools/github/src/mappers/github_compact_mappers.ts
  - tools/github/src/utils/github_search_query.ts
tags:
  - architecture
  - data-flow
---

# Data flows

## Startup flow

Once per process, before any tool call. See
[execution lifecycle](components/execution-lifecycle.md).

```
.env ──dotenv(quiet)──► process.env
   └──► stringOrNull() ──► ServerConfig { token, octokit, defaultOwner, … }
             ├──► buildServerInstructions(config) ──► client system prompt
             └──► TOOL_INSTANCES.forEach(register(server, config))
                        └──► each tool bakes config into its
                             description and its schema
```

The key move: `config` is read **once** and captured by every tool's closure.
Descriptions and schemas are therefore *computed at startup* from `.env` —
a server with defaults configured advertises different tools than one without.

## Request flow

```
1. User      "list the open issues"
2. Model     reads system prompt (owner/repo already known)
             reads tool descriptions
             emits tool_call list_github_issues { state: "open" }
3. Client    JSON-RPC ──stdin──► server
4. Zod       validates + applies schema defaults
             state=open, limit=30, sortBy=updated, sortOrder=desc
5. Handler   owner = owner?.trim() || config.defaultOwner
             ↳ both unusable → throw (see failure modes)
6. Util      buildIssueSearchQuery()
             → "repo:owner/name is:issue state:open"
7. Octokit   GET /search/issues
8. Mapper    items: GithubApiIssue[] ──mapGithubIssue──► GithubCompactIssue[]
9. Envelope  { totalCount, returned, incompleteResults?, issues }
10. Return   JSON.stringify ──► content[0].text ──stdout──► client
11. Model    reads compact JSON, answers the user
```

### Where each concern is applied

| Concern | Step | Location |
| --- | --- | --- |
| Parameter validation | 4 | `inputSchema` (zod) |
| Parameter defaults (`state`, `limit`, …) | 4 | zod `.default()` |
| Credential defaults (`owner`, `repository`) | 5 | handler, from `ServerConfig` |
| Missing-credential error | 5 | handler `throw` |
| Query construction | 6 | `utils/github_search_query.ts` |
| API error wrapping | 7 | `.catch()` on the Octokit call |
| Field selection / shrinking | 8 | `mappers/` — **the only place** |
| Truncation signalling | 9 | handler envelope |

> [!note]
> Steps 4 and 5 are two *different* default mechanisms. Zod defaults are static
> and visible in the schema. Credential defaults come from `.env`, so they are
> resolved in the handler and merely *described* in the schema. See
> [shared package](components/shared-package.md) for why the description matters.

## Two-step read pattern

Listing and reading are separate flows on purpose:

```
list_github_issues  ──► [{ number, title, state, labels, assignees, milestone }]
                                   │  no bodies — cheap
                                   ▼  model picks a number
get_github_issue    ──► { …, body }   one body — expensive, on demand
```

Returning bodies from the list would put N issue descriptions into a small
context window to answer "which issues exist?". See
[tool contract](../04-contracts/tool-contract.md#responses).

The milestone tools follow the same split, with progress counts in the place of
the body:

```
list_github_milestones ──► [{ number, title, state, description, dueOn }]
                                              │  no counts
                                              ▼  model picks a number
get_github_milestone           ──► { …, openIssues, closedIssues }
```

`get_*` must return something the `list_*` does not, or it is dead weight —
[T21](../04-contracts/tool-contract.md#responses). That is why `list_github_labels`
has no `get_github_label` counterpart: a label's compact shape is already the
whole object, so the second step would have nothing to add
([data schemas](../04-contracts/data-schemas.md#label)).

## Truncation, not pagination

The list envelope carries `totalCount` (matches in the repo) and `returned`
(rows in this page). When they differ the page is truncated and the model is
told, in the tool description, to raise `limit` rather than paginate — there is
no cursor. `incompleteResults: true` is added only when GitHub reports the
search itself timed out, which is a different thing from truncation.

**When the endpoint reports no total**, as
`GET /repos/{owner}/{repo}/milestones` and `GET /repos/{owner}/{repo}/labels`
both do, the comparison is unavailable and the envelope carries a boolean
`truncated` instead — true when the page came back full. Signalling truncation is the requirement; `totalCount` is only the
usual way of doing it
([github server](components/github-server.md#no-totalcount-on-the-plain-listings)).

## Error flow

Errors travel as thrown exceptions, which the MCP server turns into an error
result for the model — they do not become a normal response with an `error`
field. Each `throw` is written to be *actionable by the model*:

```
octokit call ──rejects──► .catch() ──► throw new Error(
    `Unable to retrieve issue "${number}": ${reason}`)
```

Catalogued in [failure modes](../05-harness/failure-modes.md).
