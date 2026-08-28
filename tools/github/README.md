# github

> Local MCP server for managing GitHub issues — part of the
> [llm_tools](../../README.md) collection.

Reads issues from the GitHub REST API and hands the model a **compact** payload instead of
the full GitHub response, which keeps the context window usable on a local model.

Owner and repository can be configured once in `.env`, so in practice you just ask
_"list the open issues"_ without naming the repo.

See the [root README](../../README.md) for requirements, the generic LM Studio walkthrough
and the conventions shared by every tool in this repository.

---

## Tools exposed

### `list_github_issues`

Searches the issues of a repository using GitHub's search API and returns one page of
matches in compact form. Pull requests are never included. Issue bodies and comments are
not returned — use `get_github_issue` to read a specific issue's content.

| Parameter    | Type                                 | Default                     | Description                                                                                                                                                       |
| ------------ | ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`      | string, optional                     | `GITHUB_DEFAULT_OWNER`      | Repository owner, e.g. `DiabdataApp`.                                                                                                                             |
| `repository` | string, optional                     | `GITHUB_DEFAULT_REPOSITORY` | Repository name, e.g. `diab-data-android`.                                                                                                                        |
| `search`     | string, optional                     | —                           | GitHub issue search syntax. Bare words match title/body/comments; qualifiers narrow further (`label:bug`, `assignee:@me`, `milestone:v2`, `created:>2026-01-01`). |
| `state`      | `open` \| `closed` \| `all`          | `open`                      | Filter issues by state.                                                                                                                                           |
| `limit`      | integer, 1–100                       | `30`                        | Maximum number of issues to return. No pagination — raise this instead.                                                                                           |
| `sortBy`     | `created` \| `updated` \| `comments` | `updated`                   | What to sort on.                                                                                                                                                  |
| `sortOrder`  | `asc` \| `desc`                      | `desc`                      | Sort direction.                                                                                                                                                   |

**Example prompts**

> _List the open issues._
>
> _Show me the 5 most recently updated closed issues._
>
> _Find issues labelled "bug" assigned to me._
>
> _List all issues on DiabdataApp/diab-data-android._

**Response shape**

```json
{
  "totalCount": 14,
  "returned": 14,
  "issues": [
    {
      "number": 42,
      "title": "Crash on glucose import",
      "url": "https://github.com/DiabdataApp/diab-data-android/issues/42",
      "state": "open",
      "labels": ["bug"],
      "assignees": ["fcossu"],
      "milestone": {
        "number": 3,
        "title": "v1.2",
        "state": "open",
        "description": null,
        "openIssues": 4,
        "closedIssues": 11,
        "dueOn": null,
        "closedAt": null,
        "url": "https://github.com/DiabdataApp/diab-data-android/milestone/3"
      }
    }
  ]
}
```

When `totalCount` and `returned` differ, results are truncated — raise `limit` to get more.
When the search timed out, `incompleteResults: true` is added to the response.

---

### `get_github_issue`

Reads a single issue by its number, including the body that `list_github_issues` leaves
out. Use `list_github_issues` first when the number is not already known. Comments are
not returned.

| Parameter    | Type             | Default                     | Description                       |
| ------------ | ---------------- | --------------------------- | --------------------------------- |
| `owner`      | string, optional | `GITHUB_DEFAULT_OWNER`      | Repository owner.                 |
| `repository` | string, optional | `GITHUB_DEFAULT_REPOSITORY` | Repository name.                  |
| `number`     | integer          | —                           | Issue number, as shown on GitHub. |

**Example prompts**

> _Read issue 108._
>
> _What does issue 42 say?_

**Response shape**

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

`body` is the issue description in Markdown, or `null` when empty.

---

## Configuration

Copy the template and fill it in:

```bash
cp .env.example .env
```

| Variable                    | Purpose                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`              | Personal access token. Without it you are limited to public repos and 60 requests/hour. A classic token with `repo` (or fine-grained _Issues: read_) is enough. |
| `GITHUB_DEFAULT_OWNER`      | Owner used when the model does not provide one.                                                                                                                 |
| `GITHUB_DEFAULT_REPOSITORY` | Repository used when the model does not provide one. Must belong to `GITHUB_DEFAULT_OWNER`.                                                                     |
| `GITHUB_DEFAULT_USERNAME`   | GitHub login substituted for the `@me` assignee sentinel in search queries.                                                                                     |

All variables are optional, but configuring the defaults lets you skip naming the
repository in every prompt.

---

## Install & register

From the repository root:

```bash
bun install
node scripts/setup-tools.mjs --write
```

Or to register only this tool:

```bash
node scripts/setup-tools.mjs --only github --write
```

---

## Register in LM Studio by hand

Add this to `~/.lmstudio/mcp.json`, replacing `/abs/path` with the absolute path to your
local clone:

```json
{
  "mcpServers": {
    "github": {
      "command": "bun",
      "args": ["/abs/path/llm_tools/tools/github/src/index.ts"]
    }
  }
}
```

---

## Project layout

```
tools/github/
├── .env.example                # credentials template — copy to .env
├── tool.json                   # install / launch contract for the root script
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                # server bootstrap, config and tool registration
    ├── metadata.ts             # constants (name, version, API defaults)
    ├── server_instructions.ts  # system prompt injected into the MCP session
    ├── models/                 # compact domain types handed to the LLM
    │   ├── github_issues.ts
    │   └── github_milestones.ts
    ├── mappers/                # GitHub API payload → compact model
    │   └── github_compact_mappers.ts
    ├── utils/
    │   └── github_search_query.ts  # builds the GitHub search query string
    └── toolbox/
        ├── index.ts            # registers all tools with the MCP server
        └── tools/
            ├── list_github_issues_by_repo.ts
            └── get_github_issue.ts
```

---

## Development

Exercise the tools through the MCP Inspector without going through LM Studio:

```bash
npx @modelcontextprotocol/inspector bun run src/index.ts
```

Or start the server directly — it will wait for stdio traffic:

```bash
bun run start
```

After changing a tool, restart the server from LM Studio to pick up the changes.
No build step is needed — Bun runs TypeScript directly.
