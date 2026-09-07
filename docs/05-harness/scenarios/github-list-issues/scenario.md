---
type: harness
status: planned
scope: github
last_reviewed: 2026-09-02
last_updated: 2026-09-03
summary: PLANNED - the reference evaluation scenario, checking a model lists open issues without asking which repository.
read_when:
  - running an evaluation by hand
  - after changing list_github_issues descriptions or server instructions
code_refs:
  - tools/github/src/toolbox/tools/list_github_issues.ts
  - tools/github/src/server_instructions.ts
tags:
  - harness
  - planned
  - evaluation
  - github
---

# Scenario: list open issues

> [!warning] No runner
> Run by hand and scored against the [rubric](../../eval-rubric.md).
> `input.json` / `expected-output.json` / `metadata.yml` are written for a
> future runner and are not consumed by anything today.

The reference scenario. It exercises the repo's central convention — a
configured default announced in
[three places](../../../02-architecture/components/shared-package.md#the-three-places-rule)
— in the simplest possible prompt.

## Preconditions

`.env` **fully configured**, server restarted, fresh chat, tool-capable model:

```
GITHUB_TOKEN=<valid>
GITHUB_DEFAULT_OWNER=<owner>
GITHUB_DEFAULT_REPOSITORY=<repo>
GITHUB_DEFAULT_USERNAME=<login>
```

Configuration is the whole point: an unconfigured server *should* ask which
repository, and asking would be correct.

## Prompt

> List the open issues.

Verbatim. No repository named, no hints.

## Expected behaviour

1. **One** call to `list_github_issues`.
2. Arguments omit `owner` and `repository` — they are configured.
3. `state` omitted or `"open"`; other parameters left at their defaults.
4. **No question to the user.**
5. Answer summarises number, title and state; no invented bodies.
6. If `totalCount > returned`, the truncation is mentioned.

```json
{ "state": "open" }
```

## Failure signals

| Observed | Diagnosis |
| --- | --- |
| "Which repository?" | **D2 = 0.** A default is missing from one of the three places, or the server was not restarted |
| `owner`/`repository` passed explicitly | Autonomy partial — the model does not trust the default |
| `get_github_issue` called per row | D5/D6 — the list already answers the question |
| Bodies described | D4 — the list returns none |
| `search: "is:issue state:open repo:…"` | D3 — those are applied automatically, and the description says so |
| `search: "label:bug"` rather than `labels: "bug"` | D3 — labels have a dedicated parameter, and `search` says not to write the qualifier |
| No tool call | Model lacks tool support, or the server is not enabled |

## Scoring

All six [rubric](../../eval-rubric.md) dimensions apply; **D2 (autonomy) is the
one this scenario exists to measure.** Anything below 2 there is a defect in the
prompt surface, not in the model.

## Variants worth running

| Prompt | Adds |
| --- | --- |
| "Show me the 5 most recently updated closed issues." | `state`, `limit`, sorting |
| "Find issues labelled bug assigned to me." | `search` qualifiers + the `@me` sentinel (D2 again, via `GITHUB_DEFAULT_USERNAME`) |
| "What does issue 42 say?" | D5 — must chain to `get_github_issue` |
| "List all issues on other-owner/other-repo." | The override path — defaults must *not* win |
