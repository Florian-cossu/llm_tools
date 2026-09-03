---
type: component
status: active
scope: github
last_reviewed: 2026-09-02
last_updated: 2026-09-03
summary: The github MCP server - its six tools, their response shapes, and its configuration.
read_when:
  - working on any github tool
  - checking which github capabilities exist
code_refs:
  - tools/github/src/toolbox/index.ts
  - tools/github/src/toolbox/tools/
  - tools/github/README.md
tags:
  - component
  - github
  - read-only
---

# github server

`@llm-tools/github` v2.2.0 — read-only access to GitHub issues, milestones and
labels.

User-facing reference (parameters, example prompts, response samples):
[`tools/github/README.md`](../../../tools/github/README.md). This note covers
structure and status.

## Registered tools

Registration order is `TOOL_INSTANCES` in
[`toolbox/index.ts`](../../../tools/github/src/toolbox/index.ts).

| Tool | Export | Endpoint | State |
| --- | --- | --- | --- |
| `list_github_issues` | `listGithubIssuesTool` | `search.issuesAndPullRequests` | Complete |
| `get_github_issue` | `getGithubIssue` | `issues.get` | Complete |
| `get_github_milestone` | `getGithubMilestone` | `issues.getMilestone` | Complete |
| `list_github_milestones` | `listGithubMilestones` | `issues.listMilestones` | Complete |
| `list_github_labels` | `listGithubLabels` | `issues.listLabelsForRepo` | Complete |
| `get_github_label` | `getGithubLabel` | `issues.getLabel` | Complete |

> [!note]
> The name the model sees is the `TOOL_NAME` constant, not the filename. Every
> file matches its tool name today, but nothing enforces that — read `TOOL_NAME`
> rather than the directory listing.

Every tool takes `owner` and `repository`, optional once the matching `.env`
default is set, resolved as `param?.trim() || config.default…` and throwing when
neither is usable.

## `list_github_issues`

The most developed tool, and the reference for the conventions here.

- Goes through **search**, not the per-repo issues endpoint, so `is:issue`
  excludes pull requests *before* counting — `totalCount` stays accurate. Query
  assembly is in [`github_search_query.ts`](../../../tools/github/src/utils/github_search_query.ts).
- Two ways in, deliberately kept to one: `search` carries free GitHub syntax,
  and **`labels` is the only route to a label filter**. `search` no longer
  offers `label:` as an example and tells the model not to write one, the same
  way it already disclaims the repo, the state and the PR exclusion — see
  [below](#the-labels-parameter).
- Returns **no bodies**. Reading one is `get_github_issue`'s job — see the
  [two-step read pattern](../data-flows.md#two-step-read-pattern).
- Envelope: `{ totalCount, returned, incompleteResults?, issues }`.
  `totalCount ≠ returned` means truncated — raise `limit`, there is no cursor.
- Rate-limited to ~30 calls/min by GitHub, and the description tells the model
  to prefer one targeted search over several broad ones.
- Defaults: `state=open`, `limit=30`, `sortBy=updated`, `sortOrder=desc`, the
  first two from [`metadata.ts`](../../../tools/github/src/metadata.ts).

### The `labels` parameter

One optional string, comma-separated, `NOT:` marking a name to exclude. The
tool normalises the spaces around the separators, then `buildIssueSearchQuery`
splits it into at most two qualifiers, quoting any name containing a space:

```
"draft, NOT: needs review"  →  label:draft -label:"needs review"
```

The parameter is a **string, not an array**, because the whole filter then
survives as one field a small model can copy from an example — and because
`NOT:` needs somewhere to live that a plain `string[]` does not offer.

> [!important] Comma means *any of*, not *all of*
> `label:a,b` is GitHub's "either label" form, so listing two names to keep
> **widens** the result rather than narrowing it. `-label:c,d` likewise drops an
> issue carrying either. The tool description states this outright, because the
> model is the one composing the list and the intuitive reading is the wrong
> one. Requiring two labels at once needs two separate `label:` qualifiers,
> which this parameter does not build today.

An unknown name is not an error — GitHub simply matches nothing — which is why
the description sends the model to `list_github_labels` or `get_github_label`
for the spelling first.

## `get_github_issue`

Single issue by number, **including `body`** (Markdown, or `null`). Comments are
not returned. Its description points the model back to `list_github_issues` when
the number isn't known.

Note it builds its compact object inline rather than calling `mapGithubIssue` —
because the detail shape adds `body`. It still uses `mapGithubMilestone` and
`mapGithubLabelNames`.

## `get_github_milestone`

Single milestone by number. Like `get_github_issue`, it spreads the shared
mapper and **adds detail the list tool omits** — here `openIssues` and
`closedIssues`, taken from `open_issues` / `closed_issues`. Without them the
tool would return exactly what `list_github_milestones` already
returns, which is why the counts live in the detail shape rather than the
compact one ([data schemas](../../04-contracts/data-schemas.md#milestone)).

Its description states the trap that matters most: **milestone numbers are
independent of issue numbers**, so milestone 1 is unrelated to issue 1. The
issues *in* a milestone are not returned — that is
`list_github_issues` with `milestone:"<title>"`.

## `list_github_milestones`

One page of milestones through `issues.listMilestones`, mapped with
`mapGithubMilestone`.

- A **plain listing, not a search** — unlike `list_github_issues` there is no
  `search` parameter, because the endpoint takes no query. The model narrows
  with `state` and reads titles.
- Envelope: `{ returned, truncated, milestones }`. **No `totalCount`** — see
  [below](#no-totalcount-on-the-plain-listings).
- `sortBy` is `due_on` | `completeness`, and is **optional**: omitting it lets
  GitHub apply its own `due_on` default.
- Defaults: `state=open`, `limit=60`, `sortOrder=desc`, the first two from
  [`metadata.ts`](../../../tools/github/src/metadata.ts).

## `list_github_labels`

One page of labels through `issues.listLabelsForRepo`, mapped with
`mapGithubLabel`.

- A **plain listing, not a search**, for the same reason as the milestone list:
  the endpoint takes no query. It is also the only list tool with **no `state`**
  — labels have no state.
- Envelope: `{ returned, truncated, labels }` — the same no-total envelope as the
  milestone list, and for the same reason
  ([below](#no-totalcount-on-the-plain-listings)).
- Compact shape is `{ name, description, color, default }` — the same shape
  `get_github_label` returns for one label, since a label has no detail behind
  it. That makes the pair an explicit exception to
  [T21](../../04-contracts/tool-contract.md#responses); see
  [below](#get_github_label-returns-no-more-than-the-list).
- Default `limit` is **100**, the endpoint maximum, from
  [`metadata.ts`](../../../tools/github/src/metadata.ts) — unlike the other
  lists, the default is expected to return everything.
- Its description points the model at the payoff: label names are what the
  `labels` parameter of `list_github_issues` filters on.

## `get_github_label`

One label by name through `issues.getLabel`, mapped with the same
`mapGithubLabel` the list uses, and returned unwrapped.

- **Keyed by name, not by number**, unlike every other `get_*` tool here. The
  name is the only identifier the compact shape carries
  ([data schemas](../../04-contracts/data-schemas.md#label)).
- A missing name is a **404 from GitHub**, so the tool throws rather than
  returning an empty result. The description turns that into the feature it is:
  the failure *is* the answer to "does this label exist?".
- The issues carrying the label are not returned — that is `list_github_issues`
  with `labels: "<name>"`.

### `get_github_label` returns no more than the list

[T21](../../04-contracts/tool-contract.md#responses) asks a `get_*` to include
what its `list_*` omits, and this one cannot: `GET /repos/{owner}/{repo}/labels/{name}`
returns exactly the fields `GET /repos/{owner}/{repo}/labels` returns per row,
and the compact shape already keeps all four of them. There is nothing left to
add.

It earns its place on a different axis — **cost and certainty** rather than
detail:

| | `list_github_labels` | `get_github_label` |
| --- | --- | --- |
| Question answered | "which labels exist?" | "does *this* label exist?" |
| Payload | up to 100 labels | one |
| Unknown name | not applicable | throws, which is the answer |

That is the same trade the two-step read pattern makes everywhere else, with
the second step buying precision instead of a body
([data flows](../data-flows.md#two-step-read-pattern)). Documented as an
exception rather than a violation: the rule T21 protects is *a `get_*` must not
be dead weight*, and a targeted lookup is not.

> [!caution] The exception is narrow
> It holds because a label's whole object fits in the compact shape. A `get_*`
> whose endpoint **does** return more must still return more — that is the
> failure `get_github_milestone` was fixed for.

### No `totalCount` on the plain listings

[T18](../../04-contracts/tool-contract.md#responses) asks lists for
`{ totalCount, returned, …, items }`. Neither `list_github_milestones`
nor `list_github_labels` can honour it: `totalCount` in `list_github_issues`
comes from the **search** endpoint's `total_count`, and the plain REST list
endpoints — `GET /repos/{owner}/{repo}/milestones` and
`GET /repos/{owner}/{repo}/labels` — return no equivalent. Emitting
`totalCount === returned` would satisfy the letter of T18 while making
truncation invisible, which is exactly what
[T19](../../04-contracts/tool-contract.md#responses) forbids.

So both envelopes carry a boolean `truncated` instead, true when the page came
back full. It over-reports by one case — a repository with exactly `limit`
milestones or labels — and that is the safe direction to be wrong in: the model
raises `limit` and sees the same list again.

## Configuration

| Variable | Effect when set |
| --- | --- |
| `GITHUB_TOKEN` | Authenticates. Without it: public repos only, 60 req/h |
| `GITHUB_DEFAULT_OWNER` | Owner fallback; enables the repository paragraph in the system prompt |
| `GITHUB_DEFAULT_REPOSITORY` | Repository fallback; must belong to the owner |
| `GITHUB_DEFAULT_USERNAME` | Resolves `@me`; enables the identity paragraph |

All optional — but setting the two repository defaults is what lets a user say
"list the open issues" without naming a repo, because the value is then stated
in all [three places](shared-package.md#the-three-places-rule).

## Adding a tool

```bash
node tools/github/scripts/add-new-implementation.mjs <tool_name> \
  --description "..."
```

Run from the repo root. Writes the file from the server's own template and
registers the export. Then replace the two `TODO`s — schema, and API call +
mapping — and document it in the server README. `list_github_milestones`
shipped registered with that second step skipped, and stayed a callable, wrong
tool until it was finished; that is the failure this step exists to prevent.

## Related

[Tool contract](../../04-contracts/tool-contract.md) ·
[GitHub API contract](../../04-contracts/github-api.md) ·
[Data schemas](../../04-contracts/data-schemas.md) ·
[Data flows](../data-flows.md)
