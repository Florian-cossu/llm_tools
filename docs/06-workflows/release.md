---
type: workflow
status: planned
scope: repo
last_reviewed: 2026-09-01
summary: PLANNED - there is no release process; servers are cloned and run in place. What versioning does mean here.
read_when:
  - bumping a server version
  - wondering how a change reaches a user
tags:
  - workflow
  - planned
  - versioning
---

# Release

> [!warning] There is no release process
> Nothing is published, tagged, built or distributed. `@llm-tools/shared` is
> `private: true`; no server is published to npm; there is no CI, no changelog
> and no tagging convention. Publishing is an explicit
> [non-goal](../01-context/goals-and-nongoals.md#non-goals).
>
> This note exists to say that clearly, and to define the one thing that *is*
> real: the version number.

## How a change actually reaches a user

```
git pull ──► bun install (if dependencies changed)
         ──► restart the server from the client
```

That is the whole mechanism. No build ([ADR-0002](../03-decisions/ADR-0002-bun-workspaces.md)),
no artefact, no distribution — a user runs the working tree.

The restart is the part that matters and the part that is forgotten: everything
the model sees is fixed at process start
([execution lifecycle](../02-architecture/components/execution-lifecycle.md)).

## What the version number means

Each server's `package.json` `version` flows through `metadata.ts` into the MCP
handshake, so **the client displays it**. It is a communication channel to
whoever is looking at the server list — the one reason to keep it honest.

Suggested reading, given the model is the consumer:

| Bump | When |
| --- | --- |
| **Major** | A tool is removed or renamed, or a response field disappears. Anything a model's learned usage depends on |
| **Minor** | A tool is added, or a field added to a response |
| **Patch** | A fix, or a description improvement that does not change the shape |

A **description change is not cosmetic** here — it can change model behaviour
more than a new field does ([agent contract](../04-contracts/agent-contract.md)).
Patch is right, but it is worth noting in the commit.

Keep the root README's [Available tools](../../README.md#available-tools)
version column in step with the bump.

## If a release process is ever needed

The things missing, in the order they would matter:

1. A per-server `CHANGELOG.md` — the model-facing surface changes silently
   today.
2. Git tags (`github-v1.5.0`), since versions are per server, not per repo.
3. CI running `bun run test` — the typecheck now exists and passes; the tests
   and the CI to run them on do not ([testing](testing.md)).
4. Only then, any form of distribution.

Steps 1–3 are worth doing regardless of whether 4 ever happens.
