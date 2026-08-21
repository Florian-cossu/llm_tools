# github_issues_manager

> Local MCP server for managing GitHub issues — part of the
> [llm_tools](../README.md) collection.

Reads issues from the GitHub REST API and hands the model a **compact** payload instead of
the full GitHub response, which keeps the context window usable on a local model.

Owner and repository can be configured once in `.env`, so in practice you just ask
_"list the open issues"_ without naming the repo.

See the [root README](../README.md) for requirements, the generic LM Studio walkthrough
and the conventions shared by every tool in this repository.

---

## Tools exposed

### `list_github_issues`

Lists the issues of a repository, most recently updated first. Pull requests are filtered
out, so you only get real issues.

| Parameter    | Type                        | Default                     | Description                                |
| ------------ | --------------------------- | --------------------------- | ------------------------------------------ |
| `owner`      | string, optional            | `GITHUB_DEFAULT_OWNER`      | Repository owner, e.g. `DiabdataApp`.      |
| `repository` | string, optional            | `GITHUB_DEFAULT_REPOSITORY` | Repository name, e.g. `diab-data-android`. |
| `state`      | `open` \| `closed` \| `all` | `open`                      | Filter issues by state.                    |
| `limit`      | integer, 1–100              | `30`                        | Maximum number of issues to return.        |

If neither the call nor `.env` provides an owner and a repository, the tool fails with an
explicit error rather than guessing.

**Example prompts**

> _List the open issues of the default repository._
>
> _Show me the 5 most recently updated closed issues._
>
> _List all issues on DiabdataApp/diab-data-android._

**Response shape**

```json
{
  "effectiveOwner": "DiabdataApp",
  "effectiveRepository": "diab-data-android",
  "state": "open",
  "count": 1,
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

---

## Configuration

Copy the template and fill it in:

```bash
cp .env.example .env
```

| Variable                    | Purpose                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`              | Personal access token. Without it you're limited to public repos and 60 requests/hour. A classic token with `repo` (or fine-grained _Issues: read_) is enough. |
| `GITHUB_DEFAULT_OWNER`      | Owner used when the model doesn't provide one.                                                                                                                 |
| `GITHUB_DEFAULT_REPOSITORY` | Repository used when the model doesn't provide one. Must belong to `GITHUB_DEFAULT_OWNER`.                                                                     |

All three are optional, but configuring the defaults is what lets you skip naming the
repository in every prompt. The `.env` is read relative to this folder, so the server
behaves the same whatever working directory the client starts it from.

---

## Install & build

From the repository root, the setup script does everything and prints the `mcp.json`
entry for you:

```bash
node scripts/setup-tools.mjs --only github_issues_manager
```

Or by hand, from this folder:

```bash
npm install
npm run build      # compiles src/ -> dist/
```

---

## Register in LM Studio

Add this to `~/.lmstudio/mcp.json`, replacing `/abs/path` with the absolute path to your
local clone (or let `node scripts/setup-tools.mjs --write` merge it in for you):

```json
{
  "mcpServers": {
    "github_issues_manager": {
      "command": "node",
      "args": ["/abs/path/llm_tools/github_issues_manager/dist/index.js"]
    }
  }
}
```

To run the TypeScript directly while iterating, skip `npm run build` and use the local
`tsx` binary instead:

```json
{
  "mcpServers": {
    "github_issues_manager": {
      "command": "/abs/path/llm_tools/github_issues_manager/node_modules/.bin/tsx",
      "args": ["/abs/path/llm_tools/github_issues_manager/src/index.ts"]
    }
  }
}
```

The [root README](../README.md#registering-a-server-in-lm-studio-by-hand) has the full
step-by-step walkthrough and a troubleshooting list.

---

## Project layout

```
github_issues_manager/
├── .env.example                # credentials template (copy to .env)
├── tool.json                   # install / build / launch contract for the root script
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # server bootstrap + tool registration
│   ├── metadata.ts             # constants & defaults (name, version, API base URL)
│   ├── models/                 # compact domain types returned to the LLM
│   │   ├── github_issues.ts
│   │   └── github_milestones.ts
│   └── mappers/                # GitHub API payload -> compact model
│       └── github_compact_mappers.ts
└── dist/                       # build output (git-ignored) — what LM Studio runs
```

---

## Development

Exercise the tools through the MCP Inspector, without going through LM Studio:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Once the behaviour is satisfying, `npm run build` and restart the server from LM Studio to
pick up the changes.
