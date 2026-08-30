---
type: harness
status: planned
scope: repo
last_reviewed: 2026-08-30
summary: PLANNED - the principles any test or eval added here should follow.
read_when:
  - writing the first tests
  - deciding what is worth testing
tags:
  - harness
  - planned
  - principles
---

# Harness principles

> [!warning] Not implemented
> No harness exists — see [overview](overview.md). These are the rules the
> first tests should be written to.

## 1. Test the pure functions first

Mappers, the query builder and the string guards are pure, fast and carry the
subtle behaviour: the `?? []` normalisation, the polymorphic label field, the
`state:all` omission. They are the highest value per line of test code in the
repo, and they need no MCP machinery at all.

## 2. Never touch the network

A test that calls GitHub is slow, flaky, rate-limited and needs a credential.
Stub `config.octokit`; feed it [fixtures](fixtures/github/README.md). The
[ServerConfig](../02-architecture/components/mcp-server.md#serverconfig) shape
makes this easy — it is a plain object, so a fake client is a literal.

## 3. Fixtures are synthetic

Hand-written, never captured from a real repository. No real usernames, no real
repository names, no token-adjacent data
([security and secrets](../04-contracts/security-and-secrets.md)). Fixtures
should also be **deliberately awkward**: an unassigned issue, a nameless label,
a null milestone, a body-less issue. A fixture of only well-formed data tests
nothing.

## 4. Test the contract, not the implementation

Assert what [tool contract](../04-contracts/tool-contract.md) and
[data schemas](../04-contracts/data-schemas.md) promise: field names, `null` vs
absent, arrays never null, `totalCount` vs `returned`. A test that breaks when a
mapper is refactored, without any observable change, is a liability.

## 5. Test what the model sees

Descriptions and schemas are an interface
([agent contract](../04-contracts/agent-contract.md)), so they are testable:

- an unconfigured server's `owner` is **required** in the schema;
- a configured server's is **optional**, and its description contains the actual
  configured value;
- `describeConfiguredRepository` returns `""` when defaults are missing;
- instruction paragraphs appear only when their config is present.

These are ordinary deterministic assertions, and they cover the repo's most
important convention.

## 6. Every fixed bug gets a test

Especially the API quirks — they are invisible until they recur.

## 7. Evals are advisory, tests are gates

An eval runs a real model and is non-deterministic; it can inform, but must
never block a commit. Deterministic tests can and should.

## 8. Prefer the test that would have caught the last real bug

`list_github_milestones_by_repo` shipped registered while still scaffold,
calling the wrong endpoint with a mis-described parameter. A test asserting that
every entry in `TOOL_INSTANCES` has a description over N characters and no
`TODO` in its source would have caught it. Write that one early.
