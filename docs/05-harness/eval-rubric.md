---
type: harness
status: planned
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-01
summary: PLANNED - how to score whether a model uses these tools correctly, run manually today.
read_when:
  - judging a change to a tool description or server instructions
  - running a scenario by hand
code_refs:
  - tools/github/src/server_instructions.ts
  - tools/shared/src/tool_description.ts
tags:
  - harness
  - planned
  - evaluation
---

# Eval rubric

> [!warning] No runner
> Nothing automates this — see [overview](overview.md). It is a **manual
> scoring sheet** for prompting a real model, and the only current check on the
> [agent contract](../04-contracts/agent-contract.md).

An eval scores the **model's behaviour**, not the tool's return value. A tool
returning perfect JSON while the model asks the user which repository is meant
has failed.

## Dimensions

Score each 0–2: **0** fails · **1** works with friction · **2** clean.

### D1 — Invocation
Did it call a tool at all, and the right one?

| 2 | Correct tool, first attempt |
| 1 | Right answer after a wrong call, or redundant calls |
| 0 | No tool call; or answered from memory; or hallucinated a tool |

### D2 — Autonomy *(the decisive one)*
Did it avoid asking for what the server already knows?

| 2 | No clarifying question; defaults omitted from the call |
| 1 | One avoidable question, or passed a default explicitly |
| 0 | Asked which repository, owner, or user was meant |

A 0 here almost always means a default is missing from one of the
[three places](../02-architecture/components/shared-package.md#the-three-places-rule).

### D3 — Parameterisation
Did it use the schema well?

| 2 | Narrowed with `search`; sensible `state`/`limit`/sort |
| 1 | Over-broad, then filtered in its own head |
| 0 | Invalid parameters; or repeated repo/state/`is:issue` inside `search` |

### D4 — Interpretation
Did it read the response correctly?

| 2 | Respected `totalCount` vs `returned`; did not invent absent fields |
| 1 | Minor misreading |
| 0 | Reported a truncated page as a total; or claimed an empty body a `list_*` never returned |

### D5 — Follow-through
Did it chain correctly?

| 2 | `list_*` → `get_*` when content was needed, unprompted |
| 1 | Chained only after being asked |
| 0 | Answered a content question from the list alone |

### D6 — Efficiency
Did it respect the budget?

| 2 | Minimum calls; one targeted search |
| 1 | Some redundancy |
| 0 | Burned the ~30/min search limit |

## Running one

1. Configure `.env` **fully** — `GITHUB_DEFAULT_OWNER`,
   `GITHUB_DEFAULT_REPOSITORY`, `GITHUB_DEFAULT_USERNAME`.
2. Restart the server ([lifecycle](../02-architecture/components/execution-lifecycle.md)).
3. Fresh chat, tool-capable model, server enabled.
4. Send the scenario prompt **verbatim**. No hints.
5. Record the tool calls made, the arguments, and every question asked.
6. Score, and record model name and quantisation — results are not comparable
   across models.

Scenarios: [scenarios/](scenarios/README.md).

## Interpreting

| Total (max 12) | Reading |
| --- | --- |
| 11–12 | The prompt surface is doing its job |
| 8–10 | Usable; one surface needs work |
| 5–7 | A description or instruction is missing something concrete |
| 0–4 | Wrong tool, or the model cannot call tools at all |

**Score D2 before anything else.** It is the dimension the repo's whole
description-writing convention exists to protect, and the one that most often
regresses silently when a tool is edited.

## Cautions

- Non-deterministic. Three runs minimum before believing a change helped.
- Advisory only — an eval must never gate a commit
  ([principles §7](principles.md)).
- Model-specific: a smaller model failing D2 where a larger one passes means the
  prompt surface is too implicit, not that the model is inadequate.
