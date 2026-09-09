# github

> Local MCP server for GitHub issues, milestones and labels — part of the
> [llm_tools](../../README.md) collection.

Talks to the GitHub REST API and hands the model a **compact** payload instead of the full
GitHub response, which keeps the context window usable on a local model.

**Six of the fourteen tools are read-only.** `create_github_label`, `update_github_label`,
`update_github_milestone`, `create_github_milestone`, `update_github_issue` and
`create_github_issue` write; `delete_github_label` and `delete_github_milestone` are
`destructive`. None of the eight is registered at all unless its permission-table row
says `allow` — every one of them seeds `deny`, so the default server is still one a
model cannot use to change anything. There is no separate env var for this; the
permission table, edited through the control panel, is the whole gate. See
[ADR-0007](../../docs/03-decisions/ADR-0007-writes-behind-declared-capability.md),
[ADR-0008](../../docs/03-decisions/ADR-0008-permission-table-gates-registration.md) and
[ADR-0009](../../docs/03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md).

> [!note] `delete_github_label` and `delete_github_milestone` need an explicit `allow`, same as the rest
> Deleting a label is the example ADR-0007 D3 used for `destructive` — a class that was
> once refused outright regardless of configuration. [ADR-0008](../../docs/03-decisions/ADR-0008-permission-table-gates-registration.md)
> revised that: both register under the same rule as any write tool, their
> permission-table row saying `allow`, which each seeds `deny`. They stay out until someone
> opens the control panel and changes that row.

Owner and repository come from whichever profile is active in the control panel, so in
practice you just ask _"list the open issues"_ without naming the repo.

See the [root README](../../README.md) for requirements and setup, and
[tools/README.md](../README.md) for the conventions shared by every server here.

---

## Tools exposed

| Tool                                                                | Purpose                                        |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| [`list_github_issues`](#list_github_issues)                         | Search issues, compact list, no bodies         |
| [`get_github_issue`](#get_github_issue)                             | Read one issue, body included                  |
| [`get_github_milestone`](#get_github_milestone)                     | Read one milestone, issue counts included      |
| [`list_github_milestones`](#list_github_milestones) | List milestones, compact, no counts            |
| [`list_github_labels`](#list_github_labels)                         | List the repository's labels, compact          |
| [`get_github_label`](#get_github_label)                             | Read one label by name, or check it exists     |
| [`create_github_label`](#create_github_label)                       | **Write** — create a new label                 |
| [`update_github_label`](#update_github_label)                       | **Write** — rename or restyle an existing label |
| [`delete_github_label`](#delete_github_label)                       | **Destructive** — delete an existing label (see the note above) |
| [`update_github_milestone`](#update_github_milestone)               | **Write** — change the title, state, description or due date of an existing milestone |
| [`create_github_milestone`](#create_github_milestone)               | **Write** — create a new milestone |
| [`delete_github_milestone`](#delete_github_milestone)               | **Destructive** — delete an existing milestone (see the note above) |
| [`update_github_issue`](#update_github_issue)                       | **Write** — change the title, body, state, milestone or assignees of an existing issue |
| [`create_github_issue`](#create_github_issue)                       | **Write** — create a new issue |

Every tool takes `owner` and `repository`, both optional once the matching `.env` default
is set, and both omitted from the tables below for brevity.

> [!warning] Eight of these write
> `create_github_label` calls `POST /labels`, `update_github_label` calls
> `PATCH /labels/{name}`, `delete_github_label` calls `DELETE /labels/{name}`,
> `update_github_milestone` calls `PATCH /milestones/{number}`,
> `create_github_milestone` calls `POST /milestones`, `delete_github_milestone`
> calls `DELETE /milestones/{number}`, `update_github_issue`
> calls `PATCH /issues/{number}`, and `create_github_issue` calls `POST /issues`;
> all eight change the
> repository. All are absent from the model's tool list unless their permission-table
> row says `allow` — each one seeds `deny`, so every one of them stays absent by
> default, independently of the others. When present each announces itself in
> its own description and each is named in the server instructions. Everything else
> here only reads.

---

### `list_github_issues`

Searches issues with GitHub's search API and returns one page in compact form. Pull
requests are never included. Bodies and comments are not returned — use
`get_github_issue` to read an issue's content.

| Parameter   | Type                                 | Default   | Description                                                                                                                                                       |
| ----------- | ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`    | string, optional                     | —         | GitHub issue search syntax. Bare words match title/body/comments; qualifiers narrow further (`author:octocat`, `assignee:@me`, `milestone:v2`, `created:>2026-01-01`). |
| `labels`    | string, optional                     | —         | Comma-separated label names to require, `NOT:`-prefixed to exclude — e.g. `draft,NOT:documentation`. See [below](#filtering-by-label).                          |
| `state`     | `open` \| `closed` \| `all`          | `open`    | Which issues to include.                                                                                                                                          |
| `limit`     | integer, 1–100                       | `30`      | Maximum number of issues. Single page, no pagination — raise this instead.                                                                                        |
| `sortBy`    | `created` \| `updated` \| `comments` | `updated` | What to sort on.                                                                                                                                                  |
| `sortOrder` | `asc` \| `desc`                      | `desc`    | Sort direction.                                                                                                                                                   |

The repository, the state, the labels and the exclusion of pull requests are applied for
you — don't repeat them in `search`.

#### Filtering by label

`labels` takes label names separated by commas. A bare name keeps issues carrying that
label; `NOT:` in front of a name drops them. Spaces inside a name are fine and quoting is
handled for you.

| `labels` | Query built |
| --- | --- |
| `bug` | `label:bug` |
| `NOT:wontfix` | `-label:wontfix` |
| `draft,NOT:documentation` | `label:draft -label:documentation` |
| `draft, NOT: needs review` | `label:draft -label:"needs review"` |

> **Several names to keep means _any_ of them, not all.** `a,b` builds `label:a,b`, which
> is GitHub's "either label" form — to require both, filter on one and read the `labels`
> field of the results. Exclusion works the same way: `NOT:c,NOT:d` drops an issue
> carrying either.

An unknown name matches no issue rather than failing, so get the spelling from
[`list_github_labels`](#list_github_labels).

**Example prompts**

> _List the open issues._
>
> _Show me the 5 most recently updated closed issues._
>
> _Find issues labelled "bug" assigned to me._
>
> _List the open issues labelled "draft" that aren't documentation._
>
> _List all issues on DiabdataApp/diab-data-android._

**Response**

```json
{
  "totalCount": 14,
  "returned": 14,
  "issues": [
    {
      "number": 42,
      "title": "Crash on glucose import",
      "state": "open",
      "labels": ["bug"],
      "assignees": ["fcossu"],
      "milestone": {
        "number": 3,
        "title": "v1.2",
        "state": "open",
        "description": null,
        "dueOn": null
      }
    }
  ]
}
```

When `totalCount` and `returned` differ, the page is truncated — raise `limit`. When the
search timed out, `incompleteResults: true` is added.

GitHub rate-limits search to about 30 calls per minute, so one well-targeted search beats
several broad ones.

---

### `get_github_issue`

Reads a single issue by number, including the body that `list_github_issues` leaves out.
Use `list_github_issues` first when the number isn't known. Comments are not returned.

| Parameter | Type    | Description                       |
| --------- | ------- | --------------------------------- |
| `number`  | integer | Issue number, as shown on GitHub. |

**Example prompts**

> _Read issue 108._
>
> _What does issue 42 say?_

**Response**

```json
{
  "number": 42,
  "title": "Crash on glucose import",
  "state": "open",
  "body": "Steps to reproduce...",
  "labels": ["bug"],
  "assignees": ["fcossu"],
  "milestone": null
}
```

`body` is Markdown, or `null` when empty.

---

### `get_github_milestone`

Reads a single milestone by its number, including the issue counts that
`list_github_milestones` leaves out. Use it when you want a milestone's progress.

| Parameter | Type    | Description                                        |
| --------- | ------- | -------------------------------------------------- |
| `number`  | integer | Milestone number, as shown in the milestone's URL. |

> **Milestone numbers are not issue numbers.** Milestone 3 has nothing to do with issue 3
> — they are separate sequences. Get the number from `list_github_milestones`.

**Example prompts**

> _How far along is milestone 3?_
>
> _When is milestone 2 due?_

**Response**

```json
{
  "number": 3,
  "title": "v1.2",
  "state": "open",
  "description": "Import pipeline hardening",
  "dueOn": "2026-09-30T07:00:00Z",
  "openIssues": 4,
  "closedIssues": 11
}
```

`dueOn` is an ISO 8601 timestamp, or `null` when no due date is set. `description` is
`null` when the milestone has none. The issues *in* the milestone are not returned — ask
`list_github_issues` for `milestone:"v1.2"`.

---

### `list_github_milestones`

Lists a repository's milestones in compact form. Unlike `list_github_issues` this is a
plain listing, not a search: GitHub's milestone endpoint takes no query, so there is no
`search` parameter. Progress counts are not included — use `get_github_milestone` for
one milestone's counts.

| Parameter   | Type                          | Default  | Description                                                                       |
| ----------- | ----------------------------- | -------- | --------------------------------------------------------------------------------- |
| `state`     | `open` \| `closed` \| `all`   | `open`   | Which milestones to include.                                                      |
| `limit`     | integer, 1–100                | `60`     | Maximum number of milestones. Single page, no pagination — raise this instead.    |
| `sortBy`    | `due_on` \| `completeness`    | —        | What to sort on. Omitted by default, which lets GitHub sort by `due_on`.          |
| `sortOrder` | `asc` \| `desc`               | `desc`   | Sort direction. Use `asc` with `due_on` to see what's due next.                   |

**Example prompts**

> _List the open milestones._
>
> _What milestone is due next?_
>
> _Show me every milestone, closed ones included._

**Response**

```json
{
  "returned": 2,
  "truncated": false,
  "milestones": [
    {
      "number": 3,
      "title": "v1.2",
      "state": "open",
      "description": "Import pipeline hardening",
      "dueOn": "2026-09-30T07:00:00Z"
    },
    {
      "number": 2,
      "title": "v1.1",
      "state": "closed",
      "description": null,
      "dueOn": null
    }
  ]
}
```

There is **no `totalCount`** here, unlike `list_github_issues`: the milestone endpoint
doesn't report one. `truncated` is `true` when the page came back full, meaning
milestones were left out — raise `limit`.

---

### `list_github_labels`

Lists a repository's labels in compact form. Like `list_github_milestones` this is a
plain listing, not a search: GitHub's label endpoint takes no query, so there is no
`search` parameter. Use it to discover the label names a `list_github_issues` search can
filter on with `label:"<name>"`.

| Parameter | Type           | Default | Description                                                                    |
| --------- | -------------- | ------- | ------------------------------------------------------------------------------ |
| `limit`   | integer, 1–100 | `100`   | Maximum number of labels. Single page, no pagination — raise this instead.     |

**Example prompts**

> _What labels does this repository use?_
>
> _List the labels, then show me the open issues labelled "bug"._

**Response**

```json
{
  "returned": 2,
  "truncated": false,
  "labels": [
    {
      "name": "bug",
      "description": "Something isn't working",
      "color": "d73a4a",
      "default": true
    },
    {
      "name": "import-pipeline",
      "description": null,
      "color": "0e8a16",
      "default": false
    }
  ]
}
```

`color` is a six-digit hex code without the leading `#`. `description` is `null` when the
label has none. `default` is `true` for the labels GitHub creates with every repository.

There is **no `totalCount`** here, for the same reason as the milestone list: the endpoint
doesn't report one. `truncated` is `true` when the page came back full, meaning labels
were left out — raise `limit`. Most repositories have fewer than 100 labels, so the
default usually returns all of them.

---

### `get_github_label`

Reads a single label by name. Unlike the other `get_*` tools it returns **no extra
fields** — a label has no detail behind it, so this is the same object
`list_github_labels` already emits for each label. What it adds is a *targeted* lookup:
checking one name without pulling the whole label set, and failing when the name doesn't
exist.

| Parameter | Type   | Description                                                                     |
| --------- | ------ | ------------------------------------------------------------------------------- |
| `name`    | string | Label name, exactly as GitHub shows it. Spaces allowed, no quotes.              |

**Example prompts**

> _Does this repository have a "needs review" label?_
>
> _What does the "wontfix" label mean here?_

**Response**

```json
{
  "name": "bug",
  "description": "Something isn't working",
  "color": "d73a4a",
  "default": true
}
```

The call **fails** when the repository has no label with that name — which is the answer
to "does this label exist?". Use `list_github_labels` when the exact spelling isn't known,
since a near-miss is an error rather than an empty result. The issues carrying the label
are not returned; ask `list_github_issues` with `labels: "<name>"`.

---

### `create_github_label`

**This tool writes.** It creates a label in the repository. It is registered
**only when its permission-table row says `allow`** — leave it at the seeded
`deny` and the server behaves exactly as it did before this tool existed,
logging `Not registering create_github_label` to stderr at startup.

Creating a label labels nothing: no issue carries it until someone applies it, and no tool
here can do that.

| Parameter     | Type              | Default | Description                                                                                                                    |
| ------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | string, required  | —       | The label name, as it should appear in GitHub. Spaces allowed, no quotes. GitHub compares names **case-insensitively**.        |
| `color`       | string, optional  | GitHub picks | Six hex digits, with or without a leading `#`. `d73a4a` and `#d73a4a` both work. Three-digit shorthand and names are rejected. |
| `description` | string, optional  | —       | What the label is for, at most 100 characters — GitHub rejects longer.                                                          |

**Example prompts**

> _Create a "needs-triage" label, grey, for issues nobody has looked at yet._
>
> _Add a label matching the convention the others use, called "blocked"._

**Response**

```json
{
  "created": true,
  "label": {
    "name": "needs-triage",
    "description": "Nobody has looked at this yet",
    "color": "d4c5f9",
    "default": false
  }
}
```

`label` is read back from GitHub rather than echoed from the input, and is the same shape
[`list_github_labels`](#list_github_labels) and [`get_github_label`](#get_github_label)
return. `default` is always `false` — only GitHub's own starter labels are `true`.

The call **fails** when a label with that name already exists (GitHub answers `422`), and
when the token has no write access. Neither is retryable: a second identical call fails
the same way, so a failure here is not a reason to try again. Call
[`list_github_labels`](#list_github_labels) first to check whether the label is already
there and to match the naming convention.

---

### `update_github_label`

**This tool writes.** It edits a label that already exists — its name, its colour, its
description — and like `create_github_label` it is registered **only when its
permission-table row says `allow`**, logging `Not registering update_github_label` to
stderr otherwise.

`name` says *which* label to edit and is never the new name; `newName` is the rename.
Every other parameter is a new value, and one you omit is left as it is, so send only what
changed rather than resending the whole label.

| Parameter     | Type              | Default   | Description                                                                                                                     |
| ------------- | ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string, required  | —         | The label's **current** name, exactly as GitHub shows it. Spaces allowed, no quotes.                                            |
| `newName`     | string, optional  | unchanged | The name to give it instead. GitHub compares names **case-insensitively**, so renaming onto an existing name fails.             |
| `color`       | string, optional  | unchanged | Six hex digits, with or without a leading `#`. `d73a4a` and `#d73a4a` both work. Three-digit shorthand and names are rejected.  |
| `description` | string, optional  | unchanged | What the label is for, at most 100 characters — GitHub rejects longer. Pass an empty string to clear it.                        |

At least one of `newName`, `color` and `description` is required. GitHub accepts a call
carrying none of them and returns the label untouched; the tool rejects it instead, rather
than reporting `"updated": true` for a change that never happened.

**Example prompts**

> _Rename the "needs-triage" label to "triage" and make it orange._
>
> _Give the "blocked" label a description saying it's waiting on something external._

**Response**

```json
{
  "updated": true,
  "label": {
    "name": "triage",
    "description": "Nobody has looked at this yet",
    "color": "d93f0b",
    "default": false
  }
}
```

`label` is read back from GitHub after the change, and is the same shape
[`list_github_labels`](#list_github_labels) and [`get_github_label`](#get_github_label)
return.

Renaming **keeps the label on the issues that carry it** — they show the new name, and no
issue gains or loses the label. No tool here can apply a label to an issue.

The call **fails** when the repository has no label with that `name`, when `newName`
collides with a label that already exists, and when the token has no write access. None is
retryable without changing the input. Call
[`list_github_labels`](#list_github_labels) or [`get_github_label`](#get_github_label)
first to confirm the exact spelling.

---

### `delete_github_label`

**This tool writes — and deletes, not undoably.** It removes a label from the repository
and declares `TOOL_EFFECT = "destructive"`. It registers **only when its
permission-table row says `allow`** — it seeds `deny`, so it stays out until someone
changes it in the control panel, logging `Not registering delete_github_label` to
stderr otherwise.

There is no endpoint that restores a deleted label, and recreating one with the same name
does not put it back on the issues it was removed from — GitHub keeps no record of which
those were. Prefer `update_github_label` when the user wants a label renamed, recoloured
or redescribed rather than gone, and confirm the exact name with the user before calling.

| Parameter | Type              | Description                                                                     |
| --------- | ----------------- | -------------------------------------------------------------------------------- |
| `name`    | string, required  | The label's name, exactly as GitHub shows it. Spaces allowed, no quotes. GitHub compares names **case-insensitively**. |

**Example prompts**

> _Delete the "wontfix" label._
>
> _Remove the "needs-triage" label — we don't use it anymore._

**Response**

```json
{
  "deleted": true,
  "name": "wontfix"
}
```

GitHub answers the delete with an empty body, so unlike `create_github_label` and
`update_github_label` there is no label object to read back — `deleted` and the echoed
`name` are the whole of what is true afterwards.

Deleting a label removes it from every issue that carried it; those issues are not
otherwise changed, and none is closed or deleted. This tool has no way to say how many
issues were affected — call `list_github_issues` with `labels: "<name>"` beforehand if
that count matters.

The call **fails** when the repository has no label with that name, and when the token
has no write access. Neither is retryable without changing the input. Call
[`list_github_labels`](#list_github_labels) or [`get_github_label`](#get_github_label)
first to confirm the exact spelling.

---

### `update_github_milestone`

**This tool writes.** It edits a milestone that already exists — its title, state,
description or due date — and like the label writes it is registered **only when its
permission-table row says `allow`**, logging `Not registering update_github_milestone`
to stderr otherwise.

`milestone_number` says *which* milestone to edit. Every other parameter is a new value,
and one you omit is left as it is, so send only what changed rather than resending the
whole milestone.

| Parameter          | Type              | Default   | Description                                                                                     |
| ------------------ | ----------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `milestone_number` | integer, required | —         | The milestone's number, from [`list_github_milestones`](#list_github_milestones).                |
| `title`             | string, optional  | unchanged | The title to give it instead.                                                                    |
| `state`             | `open` \| `closed`, optional | unchanged | A closed milestone can be shut by hand, whether or not every issue in it was finished.  |
| `description`       | string, optional  | unchanged | What the milestone is for, shown beside it in GitHub. Pass an empty string to clear it.          |
| `due_on`            | string, optional  | unchanged | ISO 8601 with time and timezone, e.g. `"2026-12-31T00:00:00Z"`.                                  |

At least one of `title`, `state`, `description` and `due_on` is required; a call carrying
none of them is rejected rather than treated as a no-op.

**Example prompts**

> _Close milestone 3._
>
> _Push the due date on milestone 2 to the end of the year._

**Response**

```json
{
  "updated": true,
  "milestone": {
    "number": 3,
    "title": "v1.2",
    "state": "closed",
    "description": "Glucose import fixes",
    "dueOn": "2026-12-31T00:00:00Z"
  }
}
```

`milestone` is read back from GitHub after the change, and is the same shape
[`list_github_milestones`](#list_github_milestones) returns.

Renaming **keeps the milestone on the issues that carry it** — they show the new title, and
this call by itself does not add or remove it from any issue. Assigning a milestone to an
issue is [`create_github_issue`](#create_github_issue)'s job at creation time, or
[`update_github_issue`](#update_github_issue)'s afterwards — not this tool's.

The call **fails** when the repository has no milestone numbered `milestone_number`, and
when the token has no write access. Neither is retryable without changing the input. Call
[`list_github_milestones`](#list_github_milestones) with a `limit` of 60 first to confirm
the exact number.

---

### `create_github_milestone`

**This tool writes.** It creates a milestone in the repository. It is registered
**only when its permission-table row says `allow`** — leave it at the seeded
`deny` and the server behaves exactly as it did before this tool existed,
logging `Not registering create_github_milestone` to stderr at startup.

Creating a milestone links no issues to it: nothing is assigned by this call. Assigning
it to an issue is [`create_github_issue`](#create_github_issue)'s job at creation time,
or [`update_github_issue`](#update_github_issue)'s afterwards — not this tool's.

| Parameter     | Type              | Default   | Description                                                                                                                    |
| ------------- | ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `title`       | string, required  | —         | The milestone's title, as it should appear in GitHub. GitHub rejects a title that already exists in the repository.           |
| `state`       | `open` \| `closed`, optional | `open` | The status to give the new milestone.                                                                                          |
| `description` | string, optional  | —         | What the milestone is for, shown beside it in GitHub.                                                                          |
| `due_on`      | string, optional  | —         | ISO 8601 with time and timezone, e.g. `"2026-12-31T00:00:00Z"`.                                                                |

**Example prompts**

> _Create a milestone called "v1.3" due at the end of the year._
>
> _Add a milestone matching the naming convention the others use, for the next release._

**Response**

```json
{
  "created": true,
  "milestone": {
    "number": 4,
    "title": "v1.3",
    "state": "open",
    "description": null,
    "dueOn": "2026-12-31T00:00:00Z"
  }
}
```

`milestone` is read back from GitHub rather than echoed from the input, and is the same
shape [`list_github_milestones`](#list_github_milestones) returns — issue counts are not
included; call [`get_github_milestone`](#get_github_milestone) with the returned `number`
for those.

The call **fails** when a milestone with this title already exists (GitHub answers `422`),
and when the token has no write access. Neither is retryable: a second identical call
fails the same way, so a failure here is not a reason to try again. Call
[`list_github_milestones`](#list_github_milestones) first to check whether the milestone
is already there and to match the naming convention.

---

### `delete_github_milestone`

**This tool writes — and deletes, not undoably.** It removes a milestone from the
repository and declares `TOOL_EFFECT = "destructive"`. It registers **only when its
permission-table row says `allow`** — it seeds `deny`, so it stays out until someone
changes it in the control panel, logging `Not registering delete_github_milestone` to
stderr otherwise.

There is no endpoint that restores a deleted milestone, and recreating one with the same
title does not put it back on the issues it was removed from — GitHub keeps no record of
which those were. Prefer `update_github_milestone` when the user wants a milestone
renamed or redescribed rather than gone, and confirm the exact title with the user before
calling.

| Parameter | Type              | Description                                                                     |
| --------- | ----------------- | -------------------------------------------------------------------------------- |
| `number`  | integer, required | The milestone's number, from [`list_github_milestones`](#list_github_milestones) or [`get_github_milestone`](#get_github_milestone). |

**Example prompts**

> _Delete milestone 2._
>
> _Remove the "v1.0" milestone — it shipped and we don't need it anymore._

**Response**

```json
{
  "deleted": true,
  "number": 2
}
```

GitHub answers the delete with an empty body, so unlike `create_github_milestone` and
`update_github_milestone` there is no milestone object to read back — `deleted` and the
echoed `number` are the whole of what is true afterwards.

Deleting a milestone removes it from every issue that carried it; those issues are not
otherwise changed, and none is closed or deleted. This tool has no way to say how many
issues were affected — call `list_github_issues` with a `search` of `milestone:"<title>"`
beforehand if that count matters.

The call **fails** when the repository has no milestone numbered `number`, and when the
token has no write access. Neither is retryable without changing the input. Call
[`list_github_milestones`](#list_github_milestones) or
[`get_github_milestone`](#get_github_milestone) first to confirm the exact number.

---

### `update_github_issue`

**This tool writes.** It edits an issue that already exists — its title, body, state,
milestone or assignees — and like the other writes it is registered **only when its
permission-table row says `allow`**, logging `Not registering update_github_issue` to
stderr otherwise.

`number` says *which* issue to edit. Every other parameter is a new value, and one you
omit is left as it is, so send only what changed rather than resending the whole issue.
This tool cannot change an issue's labels — no tool on this server can.

| Parameter          | Type              | Default   | Description                                                                                     |
| ------------------ | ----------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `number`            | integer, required | —         | The issue's number, from [`list_github_issues`](#list_github_issues) or [`get_github_issue`](#get_github_issue). |
| `title`             | string, optional  | unchanged | The title to give it instead.                                                                    |
| `body`              | string, optional  | unchanged | The issue's description in Markdown. Pass an empty string to clear it.                          |
| `state`             | `open` \| `closed`, optional | unchanged | A closed issue may have been completed or dismissed as not planned; this tool does not distinguish the two. |
| `milestone_number`  | integer, optional | unchanged | A milestone number from [`list_github_milestones`](#list_github_milestones) to attach the issue to. There is no way to clear an already-set milestone with this tool. |
| `assignees`         | string[], optional | unchanged | The **full** list of logins that should be assigned, replacing the current list rather than adding to it. Pass an empty array to unassign everyone. |

At least one of `title`, `body`, `state`, `milestone_number` and `assignees` is required;
a call carrying none of them is rejected rather than treated as a no-op.

**Example prompts**

> _Close issue 42._
>
> _Assign issue 108 to octocat and put it on milestone 3._

**Response**

```json
{
  "updated": true,
  "issue": {
    "number": 42,
    "title": "Crash on glucose import",
    "state": "closed",
    "body": "Steps to reproduce...",
    "labels": ["bug"],
    "assignees": ["octocat"],
    "milestone": {
      "number": 3,
      "title": "v1.2",
      "state": "open",
      "description": null,
      "dueOn": null
    }
  }
}
```

`issue` is read back from GitHub after the change, and is the same shape
[`get_github_issue`](#get_github_issue) returns — `labels` reflects the issue's current
labels but this tool cannot change them; no tool on this server can.

The call **fails** when the repository has no issue numbered `number`, and when the
token has no write access. Neither is retryable without changing the input. Call
[`list_github_issues`](#list_github_issues) or [`get_github_issue`](#get_github_issue)
first to confirm the exact number.

---

### `create_github_issue`

**This tool writes.** It creates an issue in the repository, always opened `open` — there
is no way to create one already closed. It is registered **only when its permission-table
row says `allow`** — leave it at the seeded `deny` and the server behaves exactly as it
did before this tool existed, logging `Not registering create_github_issue` to stderr at
startup.

Unlike a label or a milestone, **GitHub does not reject a duplicate title**: calling this
twice with the same title creates two separate issues rather than failing the second
time, so confirm with the user before calling rather than retrying a call whose result is
uncertain. This tool cannot set the issue's labels — no tool on this server can.

| Parameter          | Type              | Default    | Description                                                                                     |
| ------------------ | ----------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `title`             | string, required  | —          | The new issue's title.                                                                          |
| `body`              | string, optional  | none       | The issue's description in Markdown.                                                            |
| `milestone_number`  | integer, optional | none       | A milestone number from [`list_github_milestones`](#list_github_milestones) to attach the issue to. |
| `assignees`         | string[], optional | unassigned | The GitHub logins to assign to the new issue.                                                   |

**Example prompts**

> _Open an issue titled "Crash on glucose import" with the steps to reproduce._
>
> _Create an issue for the v1.2 milestone and assign it to octocat._

**Response**

```json
{
  "created": true,
  "issue": {
    "number": 43,
    "title": "Crash on glucose import",
    "state": "open",
    "body": "Steps to reproduce...",
    "labels": [],
    "assignees": ["octocat"],
    "milestone": null
  }
}
```

`issue` is read back from GitHub rather than echoed from the input, and is the same shape
[`get_github_issue`](#get_github_issue) returns. `labels` is always empty on a new issue,
since this tool cannot set them.

The call **fails** when the configured token has no write access to the repository, or
when `milestone_number` or an `assignees` login does not exist. None of those is
retryable without changing the input. Call
[`list_github_issues`](#list_github_issues) first to check whether a similar issue
already exists, and [`get_github_issue`](#get_github_issue) on one to match the phrasing
and structure of the bodies the repository already uses.

---

## Configuration

```bash
cp .env.example .env
```

| Variable                    | Purpose                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *(your choice)*             | Personal access token value. There is no fixed name like `GITHUB_TOKEN` anymore — add the key under whatever name you like, then register and activate it as the `auth`-type token for `github` in the control panel; the active row's name is what gets read from `.env`. Without an active token you're limited to public repos and 60 requests/hour. A classic token with `repo` (or fine-grained _Issues: read_) is enough. |
| `GITHUB_DEFAULT_USERNAME`   | GitHub login the `@me` sentinel resolves to in search queries.                                                                                                |

Both optional. There is no env var for owner/repository anymore either: add a profile in the
control panel (`bun run dev:panel`) and toggle it active — `defaultOwner`/`defaultRepository`
come from whichever `github_profiles` row has `is_active = 1`. Activating one is what lets
you skip naming the repository in every prompt — the value is injected into the server
instructions and the tool descriptions, so the model stops asking on the *next* restart.
Switching the active profile or the active token, though, takes effect on a tool's very
next call with no restart needed — both are read fresh per call, not cached at startup.
A restart is only still required to refresh the instructions/description text itself.

There is no `.env` variable for write capability. What changes what the model can *do*
rather than what it has to be told is the **permission table**, edited through the
control panel (`bun run dev:panel`) — one `allow`/`deny`/`ask` row per tool, seeded
`deny` for all eight mutating tools
([ADR-0008](../../docs/03-decisions/ADR-0008-permission-table-gates-registration.md),
[ADR-0009](../../docs/03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).
Changing a row needs a server restart to take effect, same as any other configuration
here. Two things worth knowing before flipping one to `allow`:

- A **fine-grained token with _Issues: read_** makes `create_github_label`,
  `update_github_label`, `delete_github_label`, `update_github_milestone`,
  `create_github_milestone`, `delete_github_milestone`, `update_github_issue` and
  `create_github_issue` fail even with their rows set to `allow` — milestones and
  issues sit under the same _Issues_ permission as labels. That is a good
  belt-and-braces position — the permission table decides whether the model sees the
  tool, the token decides whether the call can land.
- Issue and comment bodies are text you don't control that reaches the model. The server
  instructions tell it that such text is not you speaking, but that is prose, not a
  control. Leave every mutating tool's row at `deny` for any repository whose issues you
  don't trust.

---

## Install & register

From the repository root:

```bash
bun install
node scripts/setup-tools.mjs --only github --write
```

To register it by hand instead, see
[scripts/README.md](../../scripts/README.md#registering-a-server-by-hand).

---

## Project layout

```
tools/github/
├── .env.example                    # credentials template — copy to .env
├── tool.json                       # install / launch contract
├── package.json
├── tsconfig.json
├── scripts/
│   └── add-new-implementation.mjs  # scaffolds a new tool in the toolbox
└── src/
    ├── index.ts                    # bootstrap: .env → ServerConfig → permission gate → registration
    ├── metadata.ts                 # name, version, API defaults
    ├── server_instructions.ts      # system prompt injected into the MCP session
    ├── models/                     # GitHub API shapes + the compact shapes sent to the LLM
    │   ├── github_issues.ts
    │   ├── github_labels.ts
    │   ├── github_milestones.ts
    │   └── github_profiles.ts
    ├── mappers/
    │   └── github_compact_mappers.ts
    ├── utils/
    │   ├── github_search_query.ts  # builds the GitHub search query string
    │   └── get_repo_config.ts      # reads the active github_profiles row
    └── toolbox/
        ├── index.ts                # ToolRegistration + TOOL_REGISTRATIONS
        └── tools/
            ├── list_github_issues.ts
            ├── get_github_issue.ts
            ├── get_github_milestone.ts
            ├── list_github_milestones.ts
            ├── list_github_labels.ts
            ├── get_github_label.ts
            ├── create_github_label.ts   # write — gated at registration
            ├── update_github_label.ts   # write — gated at registration
            ├── delete_github_label.ts   # destructive — gated at registration, deny by default
            ├── update_github_milestone.ts # write — gated at registration
            ├── create_github_milestone.ts # write — gated at registration
            ├── delete_github_milestone.ts # destructive — gated at registration, deny by default
            ├── update_github_issue.ts     # write — gated at registration
            └── create_github_issue.ts     # write — gated at registration
```

---

## Adding a tool

```bash
node tools/github/scripts/add-new-implementation.mjs close_github_issue \
  --description "Close a single issue of a GitHub repository by its number."
```

Run from the repository root. It writes `src/toolbox/tools/<tool_name>.ts` from the
server's own template — owner/repository parameters, `.env` fallbacks and error handling
already in place — and registers the export in `src/toolbox/index.ts`.

Then replace the two `TODO`s: the `inputSchema` parameters, and the API call plus its
mapping into a compact shape. Finally document the tool in this README.

---

## Development

Exercise the tools through the MCP Inspector, without going through LM Studio:

```bash
npx @modelcontextprotocol/inspector bun run src/index.ts
```

Or start the server directly — it waits for stdio traffic:

```bash
bun run start
```

No build step; restart the server from LM Studio to pick up changes.
