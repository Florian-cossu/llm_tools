---
type: harness
status: draft
scope: github
last_reviewed: 2026-08-30
summary: Synthetic GitHub API fixtures, written to exercise the mapper quirks rather than the happy path.
read_when:
  - writing a test that needs an API payload
  - adding a fixture
tags:
  - harness
  - fixtures
  - github
---

# GitHub fixtures

Hand-written payloads in the **API shape** (`GithubApiIssue`,
`GithubApiMilestone`), as the mappers receive them.

| File | Shape | Endpoint it imitates |
| --- | --- | --- |
| [issue-list.json](issue-list.json) | Search response | `GET /search/issues` |
| [issue-detail.json](issue-detail.json) | Single issue, with `body` | `GET /repos/{owner}/{repo}/issues/{n}` |
| [milestone-list.json](milestone-list.json) | **Bare array**, no envelope | `GET /repos/{owner}/{repo}/milestones` |
| [milestone-detail.json](milestone-detail.json) | Single milestone | `GET /repos/{owner}/{repo}/milestones/{n}` |

The compacted results are
[github-list-issues/expected-output.json](../../scenarios/github-list-issues/expected-output.json)
and
[github-milestone-progress/expected-output.json](../../scenarios/github-milestone-progress/expected-output.json).

> [!note] Milestone numbers are not issue numbers
> `milestone-list.json` deliberately reuses the numbers 1–4 while
> `issue-list.json` uses 37–42. Milestone 3 and issue 3 would be unrelated
> objects in the same repository, and conflating them is the mistake the
> [milestone scenario](../../scenarios/github-milestone-progress/scenario.md)
> exists to catch.

## Rules

- **Synthetic, always.** Hand-written, never captured from a real repository.
  `example-org`, `example-repo`, `example-user` throughout. No tokens, no real
  logins ([security and secrets](../../../04-contracts/security-and-secrets.md)).
- **Awkward on purpose.** Each file carries a `_quirks` block naming the API
  inconsistencies it encodes — an absent `assignees` key, an explicit `null`, a
  nameless label. A fixture of well-formed data tests nothing
  ([principles §3](../../principles.md)).
- **`_comment` / `_quirks` keys are documentation** and are ignored by any
  consumer.
- When [data schemas](../../../04-contracts/data-schemas.md) change, these change
  with them.

## Quirks encoded here

| Quirk | Where |
| --- | --- |
| Search **omits** `assignees` on unassigned issues; detail returns `[]` | issue-41 vs issue-detail |
| `assignees` may be explicitly `null` | issue-37 |
| A label with an empty name must be dropped | issue-37 |
| `due_on` → `dueOn`, and `open_issues`/`closed_issues`/`html_url` dropped | every milestone |
| `body` exists only on the detail shape | issue-detail |
| The milestone list is a **bare array** — no envelope, no `total_count` | milestone-list |
| A closed milestone may still have `open_issues > 0` | milestone-1 |
| `description` and `due_on` both explicitly `null` | milestone-4 |
| `open_issues`/`closed_issues` survive into the **detail** shape only | milestone-detail |

Reference: [github API quirks](../../../04-contracts/github-api.md#quirks-that-have-bitten).
