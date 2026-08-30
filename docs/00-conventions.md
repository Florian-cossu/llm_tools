---
type: index
status: active
scope: repo
last_reviewed: 2026-08-30
summary: The frontmatter schema, linking rules and folder semantics that make this vault machine-navigable.
read_when:
  - creating a new note in this vault
  - deciding which frontmatter values a note should carry
  - building tooling that reads this vault
tags:
  - meta
  - conventions
---

# Vault conventions

This vault is written to be read by an agent that must decide *what not to
read*. Every rule below exists to make that decision cheap.

Related: [documentation index](00-index.md).

---

## Frontmatter schema

Every `.md` note carries frontmatter. Fields, in canonical order:

| Field | Required | Purpose |
| --- | --- | --- |
| `type` | yes | What kind of note this is. Controls how much authority it has. |
| `status` | yes | Whether the content can be trusted right now. |
| `scope` | yes | Which part of the repository it governs. |
| `last_reviewed` | yes | ISO date the content was last checked against the code. |
| `summary` | yes | One sentence. The retrieval hook — read this before opening the note. |
| `read_when` | recommended | Task triggers. If none match, skip the note. |
| `code_refs` | when applicable | Repo-relative paths the note describes. The doc↔code bridge. |
| `tags` | yes | Free-ish keywords for Obsidian's tag pane and graph. |

Example:

```yaml
---
type: contract
status: active
scope: github
last_reviewed: 2026-08-30
summary: The GitHub REST endpoints this server calls, and their limits.
read_when:
  - adding a tool that calls the GitHub API
code_refs:
  - tools/github/src/toolbox/tools/
tags:
  - mcp
  - github
  - read-only
---
```

### `type`

| Value | Meaning | Folder |
| --- | --- | --- |
| `index` | Map of content, routes elsewhere | `00-*` |
| `context` | Why the project exists, its limits, its words | `01-context/` |
| `architecture` | Descriptive map of the system | `02-architecture/` |
| `component` | One named piece of the system | `02-architecture/components/` |
| `decision` | An ADR — a decision plus its rationale | `03-decisions/` |
| `contract` | An interface that must hold | `04-contracts/` |
| `harness` | Testing, evaluation, observability | `05-harness/` |
| `workflow` | Steps a human or agent executes | `06-workflows/` |
| `plan` | Intent, not fact | `07-plans/` |
| `archive` | Superseded, kept for history | `99-archive/` |

### `status`

| Value | Meaning | Trust it? |
| --- | --- | --- |
| `active` | Matches the code as of `last_reviewed` | Yes |
| `draft` | Being written; partially true | Read, verify against code |
| `planned` | **Describes intent, not reality.** Nothing implements this | **No** — do not describe as existing |
| `superseded` | Replaced; the note names its replacement | No |
| `deprecated` | Still true, but on the way out | Only for history |

> [!important]
> `status: planned` is the load-bearing value. Several notes in
> [05-harness](05-harness/README.md) and [06-workflows](06-workflows/README.md) describe things
> that **do not exist yet**. Never report planned behaviour as implemented.

### `scope`

`repo` (whole repository) · `github` (the github server) · `shared`
(`@llm-tools/shared`) · `scripts` (the `.mjs` orchestration scripts) ·
`mcp` (protocol-level, server-agnostic).

---

## Linking

- **Cross-note links use relative Markdown**, e.g.
  `[tool contract](../04-contracts/tool-contract.md)`. Obsidian resolves these
  into the graph and backlinks, and they stay clickable on GitHub, in an IDE,
  and for any tool reading the raw files. Wikilinks (`[[…]]`) are **not** used —
  they break everywhere outside Obsidian.
- **Links to code** point out of the vault, e.g.
  `[index.ts](../../tools/github/src/index.ts)`. Obsidian will not resolve
  these; that is expected. The `code_refs` frontmatter field is the
  machine-readable version of the same relationship.
- **Every note links onward.** A note that answers a question should name the
  note that answers the next one.

## Naming

- Folders are numbered by reading order: `00` index, `01` context, … `99`
  archive. The numbers are the priority order, not a filing accident.
- Notes are `kebab-case.md`.
- ADRs are `ADR-NNNN-short-title.md`, sequential, never renumbered.
- Fixtures and scenario payloads keep their real extensions (`.json`, `.yml`)
  so they can be loaded directly by a future runner.

## Writing rules

- State what is true **now**. Intent belongs in [07-plans](07-plans/README.md) or behind
  `status: planned`.
- Never paste credentials, tokens, real customer data or captured production
  responses into a note or a fixture. Fixtures are synthetic. See
  [security and secrets](04-contracts/security-and-secrets.md).
- When code and a note disagree, the code is right and the note is a bug —
  fix the note and bump `last_reviewed`.
