# github

> Local MCP server for GitHub issues, milestones and labels — part of the
> [llm_tools](../../README.md) collection.

Talks to the GitHub REST API and hands the model a **compact** payload instead of the full
GitHub response, which keeps the context window usable on a local model.

**Six of the eight tools are read-only.** The other two, `create_github_label` and
`update_github_label`, write — and neither is registered at all unless you set
`GITHUB_ALLOW_WRITES`, so the default server is still one a model cannot use to change
anything. See
[ADR-0007](../../docs/03-decisions/ADR-0007-writes-behind-declared-capability.md).

Owner and repository are configured once in `.env`, so in practice you just ask _"list the
open issues"_ without naming the repo.

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

Every tool takes `owner` and `repository`, both optional once the matching `.env` default
is set, and both omitted from the tables below for brevity.

> [!warning] Two of these write
> `create_github_label` calls `POST /labels` and `update_github_label` calls
> `PATCH /labels/{name}`; both change the repository. Both are absent from the model's tool
> list unless `GITHUB_ALLOW_WRITES` is set, and when present each announces itself in its
> own description and both are named in the server instructions. Everything else here only
> reads.

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

**This tool writes.** It creates a label in the repository and is the only tool here that
changes anything. It is registered **only when `GITHUB_ALLOW_WRITES` is set** — leave that
unset and the server behaves exactly as it did before this tool existed, logging
`Not registering create_github_label` to stderr at startup.

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
description — and like `create_github_label` it is registered **only when
`GITHUB_ALLOW_WRITES` is set**, logging `Not registering update_github_label` to stderr
otherwise.

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

## Configuration

```bash
cp .env.example .env
```

| Variable                    | Purpose                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`              | Personal access token. Without it you're limited to public repos and 60 requests/hour. A classic token with `repo` (or fine-grained _Issues: read_) is enough. |
| `GITHUB_DEFAULT_OWNER`      | Owner used when a call omits it.                                                                                                                             |
| `GITHUB_DEFAULT_REPOSITORY` | Repository used when a call omits it. Must belong to `GITHUB_DEFAULT_OWNER`.                                                                                 |
| `GITHUB_DEFAULT_USERNAME`   | GitHub login the `@me` sentinel resolves to in search queries.                                                                                                |
| `GITHUB_ALLOW_WRITES`       | **Registers the write tools.** `1`, `true`, `yes` or `on` enables them; anything else, including a typo, leaves them off. Read once at startup — changing it needs a restart. |

All are optional, but setting the defaults is what lets you skip naming the repository in
every prompt — they're also injected into the server instructions and the tool
descriptions, so the model stops asking.

`GITHUB_ALLOW_WRITES` is the one that changes what the model can *do* rather than what it
has to be told. Two things worth knowing before setting it:

- A **fine-grained token with _Issues: read_** makes `create_github_label` and
  `update_github_label` fail even with the flag on. That is a good belt-and-braces position — the flag decides whether the
  model sees the tool, the token decides whether the call can land.
- Issue and comment bodies are text you don't control that reaches the model. The server
  instructions tell it that such text is not you speaking, but that is prose, not a
  control. Leave the flag unset for any repository whose issues you don't trust.

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
    ├── index.ts                    # bootstrap: .env → ServerConfig → effect gate → registration
    ├── metadata.ts                 # name, version, API defaults
    ├── server_instructions.ts      # system prompt injected into the MCP session
    ├── models/                     # GitHub API shapes + the compact shapes sent to the LLM
    │   ├── github_issues.ts
    │   ├── github_labels.ts
    │   └── github_milestones.ts
    ├── mappers/
    │   └── github_compact_mappers.ts
    ├── utils/
    │   └── github_search_query.ts  # builds the GitHub search query string
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
            └── update_github_label.ts   # write — gated at registration
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
