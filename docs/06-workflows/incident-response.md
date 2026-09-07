---
type: workflow
status: planned
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-03
summary: PLANNED - no on-call or production exists; what remains is credential compromise, which is real and urgent.
read_when:
  - a token may have been exposed
  - a tool did something unexpected
tags:
  - workflow
  - planned
  - security
---

# Incident response

> [!warning] There is no production
> No deployment, no users, no uptime, no on-call. Nothing here can page anyone.
> A broken server is a local annoyance — that is [debugging](debugging.md), not
> an incident.
>
> **One real incident class exists: a leaked credential.** That part is not
> hypothetical, and is not `planned`.

## Leaked credential — act now

A token pushed to a remote is compromised from the moment it is pushed. Assume
it has been scraped.

1. **Revoke first.** GitHub → *Settings → Developer settings → Personal access
   tokens* → revoke. Do this before anything else — before understanding how it
   happened, before touching git history. Revocation is what stops the bleeding;
   everything else is cleanup.
2. **Issue a replacement**, scoped as narrowly as it should have been:
   fine-grained, *Issues: read-only*
   ([security and secrets](../04-contracts/security-and-secrets.md#scoping-a-github-token)).
3. **Update `.env` and restart** the server — config is read once at startup.
4. **Check the blast radius.** Review the account's security log for activity
   during the exposure window. A classic `repo` token grants **write**, so
   consider what could have been changed, not only read.
5. **Fix the leak path**, then clean history if you wish. History rewriting is
   cosmetic once a token is public — it is step five for a reason.

Common leak paths, in order of likelihood: `.env` committed because a
`.gitignore` rule was missed; a token pasted into a doc, a fixture or an issue;
a token in an error message or a log; a token in `mcp.json`, which is **not**
git-ignored and is why `tool.json`'s `env` field is not for secrets.

Verify the first one:

```bash
git check-ignore -v tools/<name>/.env   # must print a matching rule
git log --all --full-history -- '*/.env'
```

## A tool did something unexpected

Read-only tooling ([ADR-0003](../03-decisions/ADR-0003-read-only-by-default.md))
means the worst case is that something was *read* and surfaced, not changed. So:

1. Identify the tool and the exact call — the Inspector, or the client's chat
   transcript.
2. Confirm the endpoint is a read:
   `grep -rn "octokit\.rest" tools/*/src/ | grep -Ev "\.(get|list|search)"`.
3. If it is **not** a read, that is a contract violation — remove the tool from
   `TOOL_REGISTRATIONS` (or unset `GITHUB_ALLOW_WRITES` if it writes),
   restart, and treat the token as over-scoped.
4. If it is a read, the exposure is informational: what did the model surface,
   and to where? Narrow the token's scope
   ([security model](../02-architecture/security-model.md#residual-risks)).

## Rate limit exhausted

Not an incident — the search budget is ~30/min and recovers on its own. If it
recurs, the tool description is not steering the model well enough
([agent contract](../04-contracts/agent-contract.md), D6 in the
[rubric](../05-harness/eval-rubric.md)).

## If this ever becomes real

It would need: a way to know a server is misbehaving without a user noticing
([observability](../05-harness/observability.md) is `draft` and servers log
almost nothing), and a rollback story — which today means `git checkout` and a
restart.
