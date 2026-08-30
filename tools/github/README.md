# github

> Local MCP server for reading GitHub issues and milestones — part of the
> [llm_tools](../../README.md) collection.

Read-only. Talks to the GitHub REST API and hands the model a **compact** payload instead
of the full GitHub response, which keeps the context window usable on a local model.

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
| [`list_github_milestones_by_repo`](#list_github_milestones_by_repo) | List milestones, compact, no counts            |

Every tool takes `owner` and `repository`, both optional once the matching `.env` default
is set, and both omitted from the tables below for brevity.

---

### `list_github_issues`

Searches issues with GitHub's search API and returns one page in compact form. Pull
requests are never included. Bodies and comments are not returned — use
`get_github_issue` to read an issue's content.

| Parameter   | Type                                 | Default   | Description                                                                                                                                                       |
| ----------- | ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`    | string, optional                     | —         | GitHub issue search syntax. Bare words match title/body/comments; qualifiers narrow further (`label:bug`, `assignee:@me`, `milestone:v2`, `created:>2026-01-01`). |
| `state`     | `open` \| `closed` \| `all`          | `open`    | Which issues to include.                                                                                                                                          |
| `limit`     | integer, 1–100                       | `30`      | Maximum number of issues. Single page, no pagination — raise this instead.                                                                                        |
| `sortBy`    | `created` \| `updated` \| `comments` | `updated` | What to sort on.                                                                                                                                                  |
| `sortOrder` | `asc` \| `desc`                      | `desc`    | Sort direction.                                                                                                                                                   |

The repository, the state and the exclusion of pull requests are applied for you — don't
repeat them in `search`.

**Example prompts**

> _List the open issues._
>
> _Show me the 5 most recently updated closed issues._
>
> _Find issues labelled "bug" assigned to me._
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
`list_github_milestones_by_repo` leaves out. Use it when you want a milestone's progress.

| Parameter | Type    | Description                                        |
| --------- | ------- | -------------------------------------------------- |
| `number`  | integer | Milestone number, as shown in the milestone's URL. |

> **Milestone numbers are not issue numbers.** Milestone 3 has nothing to do with issue 3
> — they are separate sequences. Get the number from `list_github_milestones_by_repo`.

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

### `list_github_milestones_by_repo`

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

All are optional, but setting the defaults is what lets you skip naming the repository in
every prompt — they're also injected into the server instructions and the tool
descriptions, so the model stops asking.

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
    ├── index.ts                    # bootstrap: .env → ServerConfig → tool registration
    ├── metadata.ts                 # name, version, API defaults
    ├── server_instructions.ts      # system prompt injected into the MCP session
    ├── models/                     # GitHub API shapes + the compact shapes sent to the LLM
    │   ├── github_issues.ts
    │   └── github_milestones.ts
    ├── mappers/
    │   └── github_compact_mappers.ts
    ├── utils/
    │   └── github_search_query.ts  # builds the GitHub search query string
    └── toolbox/
        ├── index.ts                # TOOL_INSTANCES
        └── tools/
            ├── list_github_issues_by_repo.ts
            ├── get_github_issue.ts
            ├── get_github_milestone.ts
            └── list_github_milestones_by_repo.ts
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
