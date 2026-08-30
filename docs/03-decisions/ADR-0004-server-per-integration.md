---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-08-30
summary: Each integration gets its own MCP server process, credentials and tool namespace, rather than one gateway server.
read_when:
  - adding a second integration
  - tempted to add an unrelated tool to an existing server
code_refs:
  - tools/
  - scripts/setup-tools.mjs
tags:
  - adr
  - architecture
  - boundaries
---

# ADR-0004: One server per integration

## Context

As integrations accumulate — GitHub, then perhaps Linear, Jira, a filesystem —
they can be exposed as one server registering every tool, or as one server per
integration.

A model sees a flat list of tool names across all connected servers, and its
ability to pick correctly degrades as that list grows. Meanwhile each
integration carries its own credentials, its own rate limits and its own ways of
failing.

## Decision

**One folder under `tools/` = one MCP server = one integration**, with its own
`package.json`, `tool.json`, `.env` and toolbox.

Cross-cutting helpers live in
[`@llm-tools/shared`](../02-architecture/components/shared-package.md), which
knows nothing about any specific integration.

## Consequences

**Gained**

- **Credentials stay separated.** A GitHub token is only ever in the process
  that needs it. A compromised or buggy dependency in one server cannot reach
  another's secrets — [security model](../02-architecture/security-model.md).
- **Failures are isolated.** A server that crashes on startup takes only its own
  tools down; the rest keep working.
- **Rate limits stay legible.** One token, one budget, one process to reason
  about.
- **Users enable what they want.** Registration is per server, so an unused
  integration costs nothing in the model's tool list —
  [setup and registration](../02-architecture/components/setup-and-registration.md).
- **Runtime freedom per server.** `tool.json` abstracts install and launch, so
  one server could be Python without disturbing the others.

**Cost**

- **Names must be globally unique anyway.** The model sees a flat list, so
  separation buys nothing at the naming level — hence the `github_` infix in
  `list_github_issues`. Server boundaries are not namespaces.
- More processes, more `.env` files, more registration entries.
- Per-server duplication of the bootstrap: every `index.ts` repeats the same
  five steps. `create-tool.mjs` scaffolds it rather than a framework abstracting
  it — accepted, since a shared bootstrap would couple servers that are
  otherwise independent.
- A capability spanning two integrations has no home. None exists yet; it would
  need its own ADR.

## Alternatives

**One gateway server registering everything.** Rejected: every credential in one
process, one crash taking down all tools, and no way for a user to enable a
subset. Its only real advantage — a single registration entry — is what
`setup-tools.mjs --write` already provides.

**Grouping by domain** (an "issue trackers" server fronting GitHub and Linear).
Rejected: it merges credentials and rate limits from unrelated vendors, and the
abstraction leaks the moment the two APIs disagree — which they do.

**One server per *tool*.** Rejected: process-per-capability, with the startup
cost and registration sprawl that implies, to separate things that already share
one credential.
