---
type: index
status: active
scope: repo
last_reviewed: 2026-08-30
summary: Index of operating workflows - setup, the inner loop, diagnosis, validation.
tags:
  - index
  - workflow
---

# 06-workflows

Step-by-step procedures.

| Workflow | Status | Use when |
| --- | --- | --- |
| [Local development](local-development.md) | active | Setting up, or starting work |
| [Debugging](debugging.md) | active | Something is broken |
| [Testing](testing.md) | draft | Validating before a commit |
| [Release](release.md) | planned | Bumping a version — there is no release process |
| [Incident response](incident-response.md) | planned | A credential may be exposed |

> [!tip]
> Two rules resolve most problems before you reach step 2 of any of these:
> **restart the server after any change**, and **never write to `stdout`**.
