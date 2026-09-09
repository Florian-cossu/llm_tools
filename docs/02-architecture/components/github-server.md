---
type: component
status: active
scope: github
last_reviewed: 2026-09-05
last_updated: 2026-09-09
summary: The github MCP server - its fourteen tools (six reads and eight gated writes), their response shapes, and its configuration.
read_when:
  - working on any github tool
  - checking which github capabilities exist
code_refs:
  - tools/github/src/toolbox/index.ts
  - tools/github/src/toolbox/tools/
  - tools/github/src/utils/get_repo_config.ts
  - tools/github/src/models/github_profiles.ts
  - tools/github/README.md
tags:
  - component
  - github
  - writes
---

# github server

`@llm-tools/github` v2.9.0 — read access to GitHub issues, milestones and
labels, plus six **writes** (`create_github_label`, `update_github_label`,
`update_github_milestone`, `create_github_milestone`, `update_github_issue`,
`create_github_issue`) and two **destructive** tools (`delete_github_label`,
`delete_github_milestone`).
None of the eight is registered unless its permission-table row is `allow` —
every one of them seeds `deny`. There is no separate write-enabling env var
([ADR-0007](../../03-decisions/ADR-0007-writes-behind-declared-capability.md),
[ADR-0008](../../03-decisions/ADR-0008-permission-table-gates-registration.md),
[ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).

User-facing reference (parameters, example prompts, response samples):
[`tools/github/README.md`](../../../tools/github/README.md). This note covers
structure and status.

## Registered tools

Registration order is `TOOL_REGISTRATIONS` in
[`toolbox/index.ts`](../../../tools/github/src/toolbox/index.ts). **Listed is
not the same as registered** — [`index.ts`](../../../tools/github/src/index.ts)
runs a **single filter** over that list: `isToolAllowed(registration.name,
"github")`, which drops anything whose permission-table row is not `allow`,
logging the reason to stderr. There is no separate effect-class gate —
`TOOL_EFFECT` still decides what `describeMutation` and the server
instructions say about a tool, but it plays no part in whether the tool
registers ([ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)
retired the older two-gate design). A newly added tool of **any** effect
class, `read` included, therefore registers only once a migration seeds its
permissions row — a forgotten row silently excludes it, the same as a `deny`
row would.

| Tool | Export | Endpoint | Effect | State |
| --- | --- | --- | --- | --- |
| `list_github_issues` | `listGithubIssuesTool` | `search.issuesAndPullRequests` | `read` | Complete |
| `get_github_issue` | `getGithubIssue` | `issues.get` | `read` | Complete |
| `get_github_milestone` | `getGithubMilestone` | `issues.getMilestone` | `read` | Complete |
| `list_github_milestones` | `listGithubMilestones` | `issues.listMilestones` | `read` | Complete |
| `list_github_labels` | `listGithubLabels` | `issues.listLabelsForRepo` | `read` | Complete |
| `get_github_label` | `getGithubLabel` | `issues.getLabel` | `read` | Complete |
| `create_github_label` | `createGithubLabel` | `issues.createLabel` | **`write`** | Complete, gated |
| `update_github_label` | `updateGithubLabel` | `issues.updateLabel` | **`write`** | Complete, gated |
| `delete_github_label` | `deleteGithubLabel` | `issues.deleteLabel` | **`destructive`** | Complete, gated — permission row seeds `deny` |
| `update_github_milestone` | `updateGithubMilestone` | `issues.updateMilestone` | **`write`** | Complete, gated |
| `create_github_milestone` | `createGithubMilestone` | `issues.createMilestone` | **`write`** | Complete, gated |
| `delete_github_milestone` | `deleteGithubMilestone` | `issues.deleteMilestone` | **`destructive`** | Complete, gated — permission row seeds `deny` |
| `update_github_issue` | `updateGithubIssue` | `issues.update` | **`write`** | Complete, gated |
| `create_github_issue` | `createGithubIssue` | `issues.create` | **`write`** | Complete, gated |

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

Like `get_github_milestone`, it spreads the shared mapper (`mapGithubIssue`)
and adds the one field the list omits — `body` — rather than reshaping the
issue by hand.

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

## The label writes

`create_github_label`, `update_github_label` and `delete_github_label` are the
tools here that change a label. None is registered unless its permission-table
row is `allow`, so on a default server (every row at its seeded `deny`) the
model never sees them
([ADR-0007](../../03-decisions/ADR-0007-writes-behind-declared-capability.md),
[ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).
All three open their description with `describeMutation(TOOL_EFFECT)` rather
than improvising a warning. `create_github_label` and `update_github_label`
return the label **read back from GitHub** through `mapGithubLabel` — the same
compact shape the two label reads return, wrapped in a one-word envelope that
says what happened:

| | `create_github_label` | `update_github_label` |
| --- | --- | --- |
| Endpoint | `issues.createLabel` | `issues.updateLabel` |
| Keyed by | the new name | `name`, the label's current name |
| Envelope | `{ created: true, label }` | `{ updated: true, label }` |
| Second identical call | fails — `422`, the name exists | succeeds, changing nothing further |
| Expected failure | name already taken | no such label (`404`), or `newName` taken (`422`) |

Two things the shapes do not show:

- **Partial update.** `issues.updateLabel` leaves out what the body leaves out,
  so `update_github_label` forwards only the parameters it was given. That makes
  a call carrying none of `newName`, `color` and `description` a no-op GitHub
  answers `200` to. The handler rejects that case before the request rather than
  returning `{ updated: true }` for a change that never happened — the one place
  either write tool checks anything at call time, and it is about honesty of the
  response, not about permission.
- **Neither touches an issue.** Creating a label labels nothing, and renaming
  one keeps it on exactly the issues that already carried it. No tool on this
  server can apply a label to an issue, and both descriptions say so, because
  the plausible-but-wrong reading is that the issues were edited.

`update_github_label` declares `write` rather than `destructive` because the
compensating action exists: a rename is undone by another rename, a colour by
another colour (D3).

### `delete_github_label`

Calls `issues.deleteLabel`, keyed by `name`. GitHub answers `204` with no
body, so there is no label to read back — the response is
`{ deleted: true, name }`, echoing the input rather than the envelope's usual
`label` object. Deleting a label removes it from every issue that carried it;
the tool has no way to report how many, and its description says so rather
than implying it knows.

This is the tool [D3](../../03-decisions/ADR-0007-writes-behind-declared-capability.md)
uses as its own example of `destructive` — undoing a delete means recreating
the label under the same name, which does not restore it to the issues it was
on, because GitHub keeps no record of which those were. It declares
`TOOL_EFFECT = "destructive"`, and registers under exactly the same rule as
any `write` tool: its permission-table row has to say `allow`, and it seeds
`deny` ([ADR-0008](../../03-decisions/ADR-0008-permission-table-gates-registration.md),
[ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).

## The milestone writes

`update_github_milestone` mirrors `update_github_label`'s shape one layer up:
`milestone_number` says which milestone, every other parameter
(`title`, `state`, `description`, `due_on`) is a new value left unchanged when
omitted, and a call carrying none of them is rejected before the request
rather than reported as a change. It calls `issues.updateMilestone` and
returns `{ updated: true, milestone }`, `milestone` read back through
`mapGithubMilestone` — the same compact shape `list_github_milestones`
returns. It does **not** include `openIssues`/`closedIssues` — those are
`get_github_milestone`'s addition, not part of the shared compact shape.

`create_github_milestone` mirrors `create_github_label`'s shape one layer up:
only `title` is required, `state` defaults to `open` the same way GitHub's own
endpoint defaults it, and it calls `issues.createMilestone`, returning
`{ created: true, milestone }` in the same compact shape as the update tool.
A second call with the same title fails rather than doing nothing — GitHub
rejects a duplicate title in a repository.

`delete_github_milestone` mirrors `delete_github_label`'s shape one layer up:
keyed by `number` rather than a name, it calls `issues.deleteMilestone` and,
since that endpoint answers `204` with no body the same way `deleteLabel`
does, returns `{ deleted: true, number }` — echoing the input rather than
reading anything back. It declares `TOOL_EFFECT = "destructive"` and
registers under the same rule as any write tool: its permission-table row
has to say `allow`, and it seeds `deny`.

Renaming, closing, creating or deleting a milestone does not touch the
issues it is on — none of the four tools' descriptions implies otherwise.
Assigning a milestone to an issue is `create_github_issue`'s job at creation
time, or `update_github_issue`'s afterwards — not any milestone tool's.

## The issue writes

`update_github_issue` and `create_github_issue` are the only tools here that
touch an issue's own fields — title, body, milestone, assignees — and the
only ones that can put a milestone on an issue or take it off the assignee
list; no other tool does. Neither can change an issue's labels — no tool on
this server can, and both descriptions say so explicitly, since a model
reading several other mutable-looking fields might otherwise assume labels
are one of them.

`update_github_issue` identifies the issue by `number`; every other
parameter (`title`, `body`, `state`, `milestone_number`, `assignees`) is a
new value left unchanged when omitted, and a call carrying none of them is
rejected before the request, the same guard the label and milestone update
tools use. It calls `issues.update` and returns `{ updated: true, issue }`,
`issue` built the same way `get_github_issue` builds its response:
`mapGithubIssue` spread with `body` added, since the detail shape (not the
list shape) is the useful one to read back after an edit that can change
the body.

`create_github_issue` mirrors it one layer up: only `title` is required,
the new issue is always `open` (GitHub's endpoint has no way to create one
already closed), and unlike a label or a milestone **GitHub does not reject
a duplicate title** — calling it twice creates two separate issues rather
than failing the second time, so its description warns the model to confirm
with the user rather than retry. It calls `issues.create` and returns
`{ created: true, issue }` in the same shape the update tool returns.

Two things worth knowing about the shared parameters:

- **`assignees` replaces the whole list** on `update_github_issue`, matching
  `issues.update`'s own semantics — it is not additive, so the description
  tells the model to pass every login that should remain assigned, not just
  the new one. `create_github_issue` has no "current list" to replace, so
  this only applies to the update tool.
- **Neither tool has a milestone-clearing path.** GitHub's `issues.update`
  endpoint accepts `null` to remove a milestone from an issue; this
  server's schema only accepts a positive integer or omission, so there is
  currently no way to unset an issue's milestone through this server. Worth
  revisiting if that need comes up.

## Configuration

| Variable | Effect when set |
| --- | --- |
| *(whichever key is the active `auth` token)* | Authenticates. Without an active one: public repos only, 60 req/h |
| `GITHUB_DEFAULT_USERNAME` | Resolves `@me`; enables the identity paragraph |

The token is no longer a fixed `GITHUB_TOKEN` lookup either: `data/access.ts`'s
`getActiveTokenName("github", "auth")` reads which `env` row is active for
github's `auth` type, and `index.ts` reads that row's `token_name` out of
`process.env` — add the key to `.env` under any name, then register and
activate it in the control panel. The owner/repository fallback works the
same way it already did: `defaultOwner`/`defaultRepository` come from
whichever `github_profiles` row has `is_active = 1`, read via
`tools/github/src/utils/get_repo_config.ts`'s `getActiveGithubProfile` — add
and activate a profile in the control panel instead of setting
`GITHUB_DEFAULT_OWNER`/`GITHUB_DEFAULT_REPOSITORY`.
`github_profiles` is github-specific, so its model and query live in the
github tool rather than in `data/access.ts` alongside the cross-server
`servers`/`permissions` tables — `data/access.ts` exports `getDb` and
`findServerBySlug` as the shared primitives that query builds on. Activating
a profile is what lets a user say "list the open issues" without naming a
repo, because the value is then stated in all
[three places](shared-package.md#the-three-places-rule).
There is no env var for write capability either: whether `create_github_label`,
`update_github_label`, `update_github_milestone`, `create_github_milestone`,
`update_github_issue`, `create_github_issue`, `delete_github_label` or
`delete_github_milestone` register is decided entirely by
their permission-table rows, edited through the same control panel
([ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).
Every permission row is still read once at registration, so changing one
still needs a **server restart** — that is what decides the tool list itself.
The active profile (and the active token) are different: `config`'s
`defaultOwner`, `defaultRepository`, `token` and `octokit` are getters, not
plain fields (see [MCP server](mcp-server.md#serverconfig)), so a tool call
reads whichever row is active *at call time* — switching the active profile
or token in the control panel takes effect on the very next call, no restart.
What still needs a restart is the tool **descriptions and schemas** mentioning
the repository, since those are strings built once when a tool registers.

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
