---
type: contract
status: active
scope: github
last_reviewed: 2026-09-01
last_updated: 2026-09-01
summary: The GitHub REST endpoints this server calls, their quirks, and the rate limits that shape tool design.
read_when:
  - adding a tool that calls the GitHub API
  - a GitHub call behaves unexpectedly
  - reasoning about rate limits or authentication
code_refs:
  - tools/github/src/toolbox/tools/
  - tools/github/src/utils/github_search_query.ts
  - tools/github/src/metadata.ts
tags:
  - mcp
  - github
  - read-only
---

# GitHub API contract

Base URL `https://api.github.com`, accessed through **Octokit**, one instance
per server on `config.octokit`. Authenticated with `GITHUB_TOKEN`, or
unauthenticated when it is absent.

## Endpoints in use

| Octokit call | REST | Used by | Read-only |
| --- | --- | --- | --- |
| `search.issuesAndPullRequests` | `GET /search/issues` | `list_github_issues` | ✅ |
| `issues.get` | `GET /repos/{owner}/{repo}/issues/{n}` | `get_github_issue` | ✅ |
| `issues.getMilestone` | `GET /repos/{owner}/{repo}/milestones/{n}` | `get_github_milestone` | ✅ |
| `issues.listMilestones` | `GET /repos/{owner}/{repo}/milestones` | `list_github_milestones` | ✅ |
| `issues.listLabelsForRepo` | `GET /repos/{owner}/{repo}/labels` | `list_github_labels` | ✅ |

Every endpoint above is a read. Adding a mutating one requires an ADR
superseding [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md).

## Search, and why it is used for listing

`list_github_issues` goes through **search**, not
`GET /repos/{owner}/{repo}/issues`. The reason is pull requests: the issues
endpoint returns them mixed in, so they must be filtered client-side — which
corrupts the count, since the total reflects pre-filter results. Search takes
`is:issue` as a *query term*, so PRs are excluded before counting and
`totalCount` stays honest.

### Query construction

Built by [`buildIssueSearchQuery`](../../tools/github/src/utils/github_search_query.ts):

```
repo:{owner}/{repository} is:issue [state:{state}] [user search terms]
```

| Rule | Why |
| --- | --- |
| `is:issue` always present | Excludes pull requests before counting |
| `state:all` is **never emitted** | **Not a valid GitHub qualifier.** Both states = omit it entirely |
| User terms appended verbatim | Full GitHub search syntax stays available |
| Repo/state/PR-exclusion applied automatically | The description tells the model not to repeat them |

`advanced_search: "true"` is passed on the call.

### Parameters

| Octokit | Source | Range |
| --- | --- | --- |
| `q` | `buildIssueSearchQuery` | — |
| `sort` | `sortBy` | `created` \| `updated` \| `comments` |
| `order` | `sortOrder` | `asc` \| `desc` |
| `per_page` | `limit` | 1–100, default 30 |

**One page only.** No `page` parameter is sent and no cursor is exposed — see
[data flows](../02-architecture/data-flows.md#truncation-not-pagination).

### Response fields consumed

`total_count` → `totalCount`; `incomplete_results` → `incompleteResults` (only
when true — it means the *search timed out*, not that the page was truncated);
`items` → mapped to compact issues.

## Listing milestones

`list_github_milestones` uses the **per-repo** endpoint, not search —
milestones are not searchable and the endpoint takes no query, which is why the
tool exposes no `search` parameter.

| Octokit | Source | Range |
| --- | --- | --- |
| `state` | `state` | `open` \| `closed` \| `all`, default `open` |
| `per_page` | `limit` | 1–100, default 60 |
| `sort` | `sortBy` | `due_on` \| `completeness`; **omitted when unset**, letting GitHub default to `due_on` |
| `direction` | `sortOrder` | `asc` \| `desc`, default `desc` |

Unlike search, `state: "all"` **is** valid here and is passed straight through —
the `state:all` prohibition applies only to the search query string.

> [!important]
> The response carries **no total count**. Search returns `total_count`; this
> endpoint returns only the page. The tool therefore emits
> `{ returned, truncated, milestones }` rather than the usual `totalCount`
> envelope — rationale in
> [github server](../02-architecture/components/github-server.md#no-totalcount-on-the-plain-listings).

Milestone numbers are their own sequence, unrelated to issue numbers: milestone
`1` and issue `1` are different objects in the same repository.

## Listing labels

`list_github_labels` uses `issues.listLabelsForRepo`. Like the milestone list it
is a plain REST listing, not a search, so the tool exposes no `search`
parameter — and unlike every other list tool it exposes **no `state`** either:
labels have none.

| Octokit | Source | Range |
| --- | --- | --- |
| `per_page` | `limit` | 1–100, default 100 |

The default is the endpoint maximum, on the assumption that a repository's whole
label set fits in one page — which is what makes the tool cheap enough to call
before a `list_github_issues` search that filters on `label:"<name>"`.

> [!important]
> This endpoint reports **no total count** either, so the tool emits
> `{ returned, truncated, labels }` — same envelope, same rationale as the
> milestone list:
> [github server](../02-architecture/components/github-server.md#no-totalcount-on-the-plain-listings).

Labels are keyed by **name**, not by number: there is no label id in the compact
shape and nothing to look one up by, which is why there is no `get_github_label`
([data schemas](data-schemas.md#label)).

## Rate limits

| Limit | Authenticated | Unauthenticated |
| --- | --- | --- |
| **Search** | **~30 req/min** | 10 req/min |
| Core (`issues.get`, …) | 5 000 req/h | 60 req/h |

The search limit is the binding one and is **separate** from the core budget. It
is stated in the `list_github_issues` description precisely because the model
decides how many calls to make — see
[agent contract](agent-contract.md#what-the-model-is-expected-to-do).

The budget belongs to the token, so it is shared across every call in a session
and across every client using that token
([execution lifecycle](../02-architecture/components/execution-lifecycle.md#what-is-not-fixed)).

## Authentication

```ts
const token = stringOrNull(process.env.GITHUB_TOKEN);
const octokit = new Octokit({ auth: token });
```

`auth: null` is valid — the server **starts without a token** (S9 in the
[server contract](mcp-server-contract.md)) and degrades to public repos at 60
req/h. Scope needed: classic `repo`, or fine-grained **Issues: read**. See
[security and secrets](security-and-secrets.md).

## Quirks that have bitten

| Quirk | Handling |
| --- | --- |
| `state:all` is not a qualifier | Omit the qualifier |
| Search omits `assignees` entirely on unassigned issues; `issues.get` returns `[]` | Mapper normalises with `?? []` — [data schemas](data-schemas.md) |
| `labels` is polymorphic (`string` or `{name}`) | `mapGithubLabelNames` accepts both |
| Search returns PRs unless `is:issue` | Always in the query |
| `incomplete_results` ≠ truncation | Surfaced as a distinct field |
| Closed-as-completed vs closed-as-not-planned | Not distinguished; the description says so |
| `listMilestones` reports no total | Envelope uses `truncated` instead of `totalCount` |
| `listLabelsForRepo` reports no total either | Same `truncated` envelope |
| A label `color` has **no leading `#`** | Passed through as GitHub sends it; the description says so |
| Milestone numbers ≠ issue numbers | Stated in both milestone tool descriptions |

## Error handling

Octokit rejects on non-2xx. Every call is wrapped:

```ts
.catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(`Unable to retrieve issue "${number}": ${reason}`);
});
```

Status-code meanings and their model-facing messages:
[failure modes](../05-harness/failure-modes.md).
