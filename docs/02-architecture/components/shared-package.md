---
type: component
status: active
scope: shared
last_reviewed: 2026-08-30
summary: "@llm-tools/shared: string guards plus the helpers that keep a parameter's prose and its schema in agreement."
read_when:
  - writing tool or parameter descriptions
  - reading .env values into config
  - wondering why a model keeps asking for values the server already has
code_refs:
  - tools/shared/src/string_utils.ts
  - tools/shared/src/tool_description.ts
tags:
  - component
  - shared
  - prompt-engineering
---

# `@llm-tools/shared`

The workspace package every server imports. Two files, one theme: **make the
model's view of a parameter consistent with the server's.**

Imported as `@llm-tools/shared`, mapped to source by the root
`tsconfig.json` — no build step.

## `string_utils.ts`

| Export | Purpose |
| --- | --- |
| `isStringUsable(s)` | Type guard: non-null, non-undefined, non-empty |
| `isStringUnusable(s)` | Its negation, as a guard |
| `stringOrNull(s)` | Trimmed string, or `null` when unusable |

`stringOrNull` is the standard way to read `.env`. It exists because
`process.env.FOO ?? null` is wrong here: an unset variable and an empty one
(`GITHUB_TOKEN=` — exactly what `.env.example` produces on copy) must behave
identically, and `??` only catches the first.

## `tool_description.ts`

These three exist because of one observed failure: **a small model reads the
tool description before it reads the JSON schema.** State a default only in the
schema and the model asks the user for a value the server already holds.

### `describeDefault(configured, whenMissing)`

Parameter description text. Interpolates the configured value so the model can
*see* what will be used, or falls back to the "required" wording.

```ts
owner: optionalWhenConfigured(config.defaultOwner).describe(
  "GitHub repository owner (user or organisation). " +
    describeDefault(
      config.defaultOwner,
      "Required, as no default owner is configured on this server.",
    ),
),
```

### `describeConfiguredRepository(owner, repository)`

A **tool-description prefix** stating the repository is already known. Returns
`""` when either value is missing, so a server without defaults never promises
one. Prepended to every github tool description.

### `optionalWhenConfigured(configured)`

`z.string()` when nothing is configured, `z.string().optional()` otherwise. The
schema a model sees carries more weight than the prose beside it, so a parameter
`describeDefault` calls *required* must actually be required in the schema —
rather than optional everywhere and rejected at call time.

## The three-places rule

A configured default has to be announced in **three** places, because each is
read at a different moment:

| Place | Read when | Built by |
| --- | --- | --- |
| Server instructions | The model is deciding whether it can answer at all | `buildServerInstructions` — [mcp-server](mcp-server.md#server-instructions) |
| Tool description | The model is deciding *which* tool to call | `describeConfiguredRepository` |
| Parameter description + schema | The model is filling in arguments | `describeDefault` + `optionalWhenConfigured` |

Miss one and the model asks the user a question the server could have answered.
This is the single most important convention in the repo — see the
[agent contract](../../04-contracts/agent-contract.md).

## Boundaries

- **Nothing integration-specific.** No GitHub types, no Octokit. A helper that
  would need them belongs in the server.
- **Pure and dependency-light** — `zod` is the only library it touches, and it
  is resolved from the root manifest rather than declared here
  ([ADR-0005](../../03-decisions/ADR-0005-root-dependencies.md)).
- **Additive changes only** in practice: every server imports it, and there is
  no test suite to catch a regression ([testing](../../06-workflows/testing.md)).
