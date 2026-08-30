---
type: contract
status: active
scope: github
last_reviewed: 2026-08-30
summary: The API and compact shapes, the mappers between them, and the envelopes tools return.
read_when:
  - changing what a tool returns
  - adding a field, or deciding whether to drop one
  - writing a fixture or an expected output
code_refs:
  - tools/github/src/models/github_issues.ts
  - tools/github/src/models/github_milestones.ts
  - tools/github/src/mappers/github_compact_mappers.ts
tags:
  - contract
  - schema
  - github
---

# Data schemas

Every external object exists **twice**: as the API returns it, and as the model
sees it — with exactly one pure function between them.

```
GithubApiIssue ──mapGithubIssue──► GithubCompactIssue ──stringify──► model
```

This is the load-bearing rule of the repo: it keeps responses inside a local
context window, and makes dropping a field a one-line change in one file.

## Types

### Issue

| API `GithubApiIssue` | Compact `GithubCompactIssue` | Note |
| --- | --- | --- |
| `number` | `number` | |
| `title` | `title` | |
| `state` | `state` | `"open" \| "closed"` |
| `labels: {name}[]` | `labels: string[]` | Flattened by `mapGithubLabelNames` |
| `assignees?: {login}[] \| null` | `assignees: string[]` | **Optional in, always array out** |
| `milestone: GithubApiMilestone \| null` | `milestone: GithubCompactMilestone \| null` | Nested, recursively compacted |
| `html_url` | — | Dropped |
| `pull_request?` | — | Dropped; presence marks a PR |

> [!note]
> `assignees` is optional because **the search endpoint omits the field entirely
> on unassigned issues** while the issues endpoint returns `[]`. The mapper
> normalises with `?? []`, so the model always receives an array. This is a real
> API inconsistency, not defensive coding.

### Milestone

| API `GithubApiMilestone` | Compact `GithubCompactMilestone` | Note |
| --- | --- | --- |
| `number` | `number` | |
| `title` | `title` | |
| `state` | `state` | |
| `description` | `description` | `string \| null` |
| `due_on` | `dueOn` | **Renamed** — ISO 8601 or `null` |
| `open_issues`, `closed_issues` | — | Dropped |
| `closed_at`, `html_url` | — | Dropped |

`open_issues`/`closed_issues` would answer "how much is left in this milestone?"
— worth reconsidering when `list_github_milestones_by_repo` is finished
([current plan](../07-plans/current.md)).

### Issue detail

`get_github_issue` returns the compact issue **plus `body`** (`string | null`,
Markdown). It builds this inline rather than through `mapGithubIssue`, since the
shape differs — while still using `mapGithubMilestone` and
`mapGithubLabelNames`.

## Mappers

All in [`github_compact_mappers.ts`](../../tools/github/src/mappers/github_compact_mappers.ts).
Pure: no network, no `config`, no throwing.

| Mapper | Signature |
| --- | --- |
| `mapGithubIssue` | `GithubApiIssue → GithubCompactIssue` |
| `mapGithubMilestone` | `GithubApiMilestone → GithubCompactMilestone` |
| `mapGithubLabelNames` | `Array<string \| {name?}> → string[]`, dropping unusable |

`mapGithubLabelNames` accepts both forms because GitHub's label field is
polymorphic across endpoints; it filters with `isStringUsable`, so a nameless
label vanishes rather than becoming `undefined` in the array.

## Envelopes

### List

```json
{
  "totalCount": 14,
  "returned": 14,
  "incompleteResults": true,
  "issues": [ /* GithubCompactIssue[] */ ]
}
```

| Field | Meaning |
| --- | --- |
| `totalCount` | Matches in the repository — **the only figure reportable as a total** |
| `returned` | Rows in this page. `≠ totalCount` means truncated; raise `limit` |
| `incompleteResults` | Present **only when true**: GitHub reported the search timed out. Distinct from truncation |
| `issues` | The rows |

### Detail

The compact object itself, unwrapped.

Both are `JSON.stringify`-ed into `content[0].text` — see
[tool contract](tool-contract.md#responses).

## Changing a shape

1. Update the `…Api…` type if the API side changed.
2. Update the `…Compact…` type.
3. Update the mapper — **the only place a field is dropped or renamed**.
4. Update the tool description; it states the shape inline and the model relies
   on that ([agent contract](agent-contract.md)).
5. Update the server README's response sample.
6. Update the [fixtures](../05-harness/fixtures/github/README.md) and this note.

Step 4 is the one that gets forgotten, and the model has no way to notice.

## Rules

- Compact shapes are **camelCase** (`dueOn`); API shapes keep the API's casing
  (`due_on`).
- Absent is `null`, never `undefined` — `undefined` disappears through
  `JSON.stringify` and the model cannot distinguish "absent" from "not
  returned".
- Collections are always arrays, never `null`.
- Drop by default. A field the model will not act on is context spent for
  nothing.
- Never hand a raw API payload to the model.
