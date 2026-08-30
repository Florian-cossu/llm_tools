---
type: component
status: draft
scope: github
last_reviewed: 2026-08-30
summary: The github MCP server - its four tools, its configuration, and the one that is still scaffold.
read_when:
  - working on any github tool
  - checking which github capabilities exist and which are stubs
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

`@llm-tools/github` v1.3.0 — read-only access to GitHub issues and milestones.

User-facing reference (parameters, example prompts, response samples):
[`tools/github/README.md`](../../../tools/github/README.md). This note covers
structure and status.

> [!warning] `status: draft`
> One of the four registered tools is still scaffold — see
> [below](#list_github_milestones_by_repo--scaffold).

## Registered tools

Registration order is `TOOL_INSTANCES` in
[`toolbox/index.ts`](../../../tools/github/src/toolbox/index.ts).

| Tool | Export | Endpoint | State |
| --- | --- | --- | --- |
| `list_github_issues` | `listGithubIssuesByRepoTool` | `search.issuesAndPullRequests` | Complete |
| `get_github_issue` | `getGithubIssue` | `issues.get` | Complete |
| `get_github_milestone` | `getGithubMilestone` | `issues.getMilestone` | Complete |
| `list_github_milestones_by_repo` | `listGithubMilestonesByRepo` | `issues.get` ← **wrong** | **Scaffold** |

> [!note]
> The public tool name and the file name do not always match:
> `list_github_issues` lives in `list_github_issues_by_repo.ts`. The name the
> model sees is the `TOOL_NAME` constant, not the filename.

Every tool takes `owner` and `repository`, optional once the matching `.env`
default is set, resolved as `param?.trim() || config.default…` and throwing when
neither is usable.

## `list_github_issues`

The most developed tool, and the reference for the conventions here.

- Goes through **search**, not the per-repo issues endpoint, so `is:issue`
  excludes pull requests *before* counting — `totalCount` stays accurate. Query
  assembly is in [`github_search_query.ts`](../../../tools/github/src/utils/github_search_query.ts).
- Returns **no bodies**. Reading one is `get_github_issue`'s job — see the
  [two-step read pattern](../data-flows.md#two-step-read-pattern).
- Envelope: `{ totalCount, returned, incompleteResults?, issues }`.
  `totalCount ≠ returned` means truncated — raise `limit`, there is no cursor.
- Rate-limited to ~30 calls/min by GitHub, and the description tells the model
  to prefer one targeted search over several broad ones.
- Defaults: `state=open`, `limit=30`, `sortBy=updated`, `sortOrder=desc`, the
  first two from [`metadata.ts`](../../../tools/github/src/metadata.ts).

## `get_github_issue`

Single issue by number, **including `body`** (Markdown, or `null`). Comments are
not returned. Its description points the model back to `list_github_issues` when
the number isn't known.

Note it builds its compact object inline rather than calling `mapGithubIssue` —
because the detail shape adds `body`. It still uses `mapGithubMilestone` and
`mapGithubLabelNames`.

## `get_github_milestone`

Single milestone by number → `mapGithubMilestone`. Complete and correct, though
a leftover `// TODO` comment above the call is stale, and its description is one
short line where the other complete tools describe their response shape — worth
bringing up to the [tool contract](../../04-contracts/tool-contract.md#descriptions)
standard.

## `list_github_milestones_by_repo` — scaffold

**Registered and callable, but wrong.** It is the untouched output of
`add-new-implementation.mjs`:

- takes a `number` parameter described as *"the issue within its repository"*;
- calls `octokit.rest.issues.get` — the **issue** endpoint;
- returns the raw payload with no mapper;
- has a truncated description ending in a bare colon.

Because it is in `TOOL_INSTANCES`, the model can and will call it. Finishing it
means: replace the schema with `state`/`sort`/`direction`/`limit`, call
`octokit.rest.issues.listMilestones`, and map through `mapGithubMilestone`.

Tracked in [current plan](../../07-plans/current.md).

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
mapping — and document it in the server README. `list_github_milestones_by_repo`
is what happens when that second step is skipped.

## Related

[Tool contract](../../04-contracts/tool-contract.md) ·
[GitHub API contract](../../04-contracts/github-api.md) ·
[Data schemas](../../04-contracts/data-schemas.md) ·
[Data flows](../data-flows.md)
