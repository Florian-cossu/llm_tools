---
type: contract
status: active
scope: mcp
last_reviewed: 2026-08-30
summary: What the server promises the model, what the model is expected to do, and the prompt-surface rules that make it work.
read_when:
  - writing or reviewing any text a model will read
  - the model asks for values the server already has
  - the model picks the wrong tool or over-calls
code_refs:
  - tools/github/src/server_instructions.ts
  - tools/shared/src/tool_description.ts
tags:
  - contract
  - agent
  - prompt-engineering
---

# Agent contract

The other contracts govern code. This one governs the **prompt surface** — every
string a model reads — and treats it as an interface with a consumer whose
behaviour is observable.

The consumer is assumed to be a **small local model**: it reads prose before
schemas, does not infer, and asks the user when unsure.

## What the server promises the model

| # | Promise | Delivered by |
| --- | --- | --- |
| A1 | Tools are read-only; calling one changes nothing | [ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md) |
| A2 | Configured values are supplied automatically — never ask the user | [Three-places rule](#the-three-places-rule) |
| A3 | Responses are compact and structured, described before they arrive | [Data schemas](data-schemas.md) |
| A4 | Truncation is always visible, never silent | `totalCount` vs `returned` |
| A5 | Errors say what went wrong and what to do | [Failure modes](../05-harness/failure-modes.md) |
| A6 | A tool that is one step of a workflow names the next tool | Tool descriptions |

Because of A1, tools may be called **without confirming with the user** — the
property that makes them pleasant rather than tedious.

## What the model is expected to do

| # | Expectation | Enforced by |
| --- | --- | --- |
| A7 | Omit `owner`/`repository` when the server is configured | Server instructions + description prefix |
| A8 | Never ask which repository is meant | Explicit "never ask the user" wording |
| A9 | Read "my issues" as `assignee:@me` | Identity paragraph |
| A10 | Narrow with `search` rather than list-then-filter | Description of `search` |
| A11 | Prefer one targeted search over several broad ones | Stated rate limit |
| A12 | Use `get_*` for content, `list_*` for existence | Both descriptions |
| A13 | Raise `limit` rather than expect pagination | Description of `limit` |

## The three-places rule

The central finding of this repo. Each surface is read at a **different decision
point**, so a fact stated in only one arrives too late:

| Surface | The model is deciding | Written by |
| --- | --- | --- |
| **Server instructions** (system prompt) | *Can I answer at all, or must I ask the user?* | `buildServerInstructions(config)` |
| **Tool description** | *Which tool do I call?* | `describeConfiguredRepository(...)` + prose |
| **Parameter description & schema** | *What do I put in this field?* | `describeDefault(...)` + `optionalWhenConfigured(...)` |

State a default only in the schema, and the model has already asked the user by
the time it reads it. Implementation:
[shared package](../02-architecture/components/shared-package.md).

## Rules for writing model-facing text

- **Interpolate the actual value.** *"Defaults to the configured value
  (`octocat/hello-world`)"* beats *"defaults to the configured owner"* — the
  model can see there is nothing to ask about.
- **Say "never ask the user"** when that is what you mean. Implication does not
  work.
- **Promise nothing unconfigured.** `describeConfiguredRepository` returns `""`
  when defaults are missing, and instruction paragraphs are emitted
  conditionally. A promised-but-absent default is worse than none.
- **Describe the response shape in the description.** It saves the model a round
  of guessing at what it just received.
- **Say what is *not* returned.** "Bodies and comments are not returned" stops
  the model reporting an absent body as an empty one.
- **State limits as guidance.** The model is the one choosing how many calls to
  make; tell it the budget.
- **Keep prose and schema in agreement.** A parameter called required in prose
  must be required in the schema — T9 in the
  [tool contract](tool-contract.md#input-schema).

## Anti-patterns

| Symptom | Cause | Fix |
| --- | --- | --- |
| Model asks "which repository?" | Default stated in fewer than three places | Add the missing surface |
| Model calls the wrong tool | Descriptions do not distinguish list from get | State what each returns and does not return |
| Model reports empty bodies from a list | Absence not stated | "Bodies are not returned" |
| Model burns the rate limit | No stated budget | Name the limit and the preference |
| Model asks permission for every read | A1 never stated | Say the tools are read-only — the paragraph is currently **commented out** in `server_instructions.ts` |
| Model reports a truncated page as a total | Envelope ignored | Explain `totalCount` vs `returned` |

## Verifying

There is no automated check on this surface —
[05-harness](../05-harness/overview.md) is `status: planned`. Until then it is
verified by prompting: [eval rubric](../05-harness/eval-rubric.md) and the
[scenario](../05-harness/scenarios/github-list-issues/scenario.md).

The decisive test is **conversational, not structural**: ask *"list the open
issues"* with defaults configured, and the model must answer without a single
clarifying question.
