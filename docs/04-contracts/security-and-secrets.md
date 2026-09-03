---
type: contract
status: active
scope: repo
last_reviewed: 2026-08-30
last_updated: 2026-09-03
summary: Operational rules for credentials - where they live, what must never be committed, and how to scope a token.
read_when:
  - adding a credential or an environment variable
  - writing a fixture, a log line or an error message
  - before any commit that touches config
code_refs:
  - .gitignore
  - tools/github/.env.example
  - tools/github/src/index.ts
tags:
  - contract
  - security
  - secrets
---

# Security and secrets

Operational rules. The reasoning behind them:
[security model](../02-architecture/security-model.md).

## Where credentials live

| Location | Holds | Committed |
| --- | --- | --- |
| `tools/<name>/.env` | Real credentials | **Never** |
| `tools/<name>/.env.example` | Variable names + comments, **empty values** | Yes |
| `~/.lmstudio/mcp.json` | Launch command and path | Outside the repo |
| `tool.json` `env` | Non-secret environment only | Yes — **so never a secret** |

`.gitignore` covers `*.env` and `*.env.*` with `!.env.example` re-included.
Verify before committing:

```bash
git check-ignore -v tools/<name>/.env   # must print a matching rule
git status --porcelain | grep -i '\.env$'   # must be empty
```

## Never commit

- Tokens, keys, passwords, session cookies.
- Real customer or personal data.
- **Captured production API responses.** Fixtures are hand-written and
  synthetic — [fixtures](../05-harness/fixtures/github/README.md).
- Logs or test snapshots containing any of the above.
- A real owner/repository/username in a *tracked* file, where it would leak what
  is being worked on. `.env.example` ships empty values.

## Never emit

`stdout` is the JSON-RPC wire, but the rule is broader — a secret must not reach
**any** output:

| Channel | Rule |
| --- | --- |
| `stdout` | Protocol only. Nothing else, ever |
| `stderr` | Diagnostics, no secrets — [observability](../05-harness/observability.md) |
| Tool responses | Compact shapes only |
| Error messages | Context and cause, never the credential or a raw HTTP dump |

The concrete trap: `dotenv` prints a banner to `stdout` by default, which both
leaks and breaks the transport. Hence `quiet: true` in every server's
`index.ts`.

## Adding a variable

1. Add it to `.env.example` with an empty value and a comment saying what it is
   and whether it is required.
2. Read it through `stringOrNull(process.env.X)`, so unset and empty behave
   identically.
3. Put it on `ServerConfig` — never read `process.env` inside a tool.
4. If it is a **default** rather than a credential, announce it in all
   [three places](../02-architecture/components/shared-package.md#the-three-places-rule).
5. Document it in the server README.
6. **A missing value must not crash startup** — S9 in the
   [server contract](mcp-server-contract.md).

## Scoping a GitHub token

The narrowest thing that works:

- **Fine-grained**: *Issues: Read-only*, on the specific repositories intended.
- **Classic**: `repo` — coarse, and grants write. Prefer fine-grained.
- **No token**: public repos only, 60 req/h. Valid for public work.

Token scope is the one control the repository cannot enforce for you, and it
matters more now that writes exist. The tools guarantee only that a mutating one
is not registered unless you enabled it
([ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)); a
token carrying write scope stays write-capable for any other client using the
same `.env`. **A fine-grained *Issues: Read-only* token makes
`create_github_label` and `update_github_label` fail even when writes are
enabled** — which is the
belt-and-braces position, and the right default until you want the write.

## Rotating or revoking

1. Revoke at the provider.
2. Replace the value in `.env`.
3. **Restart the server from the client** — config is read once at startup
   ([execution lifecycle](../02-architecture/components/execution-lifecycle.md)).

If a token was ever committed: revoke first, then worry about history. It is
public from the moment it is pushed.

## Review checklist

Before any commit touching config, credentials or fixtures:

- [ ] No `.env` staged
- [ ] `.env.example` values are empty
- [ ] No token, key or real personal data in any tracked file
- [ ] Fixtures are synthetic
- [ ] No new write to `stdout`
- [ ] No credential interpolated into an error message
- [ ] New variables documented in `.env.example` **and** the server README
