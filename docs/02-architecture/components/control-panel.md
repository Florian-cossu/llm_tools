---
type: component
status: active
scope: repo
last_reviewed: 2026-09-06
last_updated: 2026-09-09
summary: A Next.js app that reads and edits data/harness.db's servers, permissions, github_profiles, env and events tables - all but events read by the github server at registration or per call.
read_when:
  - working on control_panel
  - wondering whether the permission layer exists yet
  - a shadcn command changed control_panel/package.json
  - working on github profiles, the active-profile toggle, or the active-token toggle
  - working on the metrics dashboard
code_refs:
  - control_panel/lib/db.ts
  - control_panel/lib/servers.ts
  - control_panel/lib/tokens.ts
  - control_panel/lib/events.ts
  - control_panel/lib/github/tools.ts
  - control_panel/app/servers/github/page.tsx
  - control_panel/app/servers/github/lib/github_profiles.tsx
  - control_panel/app/metrics/page.tsx
  - control_panel/app/api/github_mcp_update_permission/route.ts
  - control_panel/app/api/github_add_profile/route.ts
  - control_panel/app/api/github_set_active_profile/route.ts
  - control_panel/app/api/token_add/route.ts
  - control_panel/app/api/token_set_active/route.ts
  - scripts/rehome-panel-deps.mjs
  - data/access.ts
  - tools/github/src/index.ts
  - tools/github/src/utils/get_repo_config.ts
  - tools/shared/src/tracking.ts
tags:
  - component
  - control-panel
  - permissions
  - nextjs
---

# Control panel

`control_panel/` is a Next.js app that lets a human read and edit `servers`
(names, icons), `permissions` (the per-tool permission table),
`github_profiles` (named owner/repo presets) and `env` (named, typed tokens),
plus a read-only view of `events`, all in [`data/harness.db`](data-store.md).
It is a workspace member (`@llm-tools/control-panel` in the root `workspaces`
array), run with:

```bash
bun run dev:panel
```

> [!note] Three tables reach the server; one is read-only here
> Editing a tool's `state` here writes the row `tools/github/src/index.ts`
> reads via `isToolAllowed`
> ([ADR-0008](../../03-decisions/ADR-0008-permission-table-gates-registration.md),
> [ADR-0009](../../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)) —
> flipping it changes what the model can see, but only after a **server
> restart**, since the permission table is read once at startup. Toggling a
> `github_profiles` row or an `env` token active is different: both are read
> **per tool call** (`getActiveGithubProfile`, `getActiveTokenName`), so
> either takes effect on the very next call, no restart — see
> [MCP server](mcp-server.md#serverconfig). `ask` is editable but has no
> effect distinct from `deny` yet, and there's no audit trail for any of
> these tables. `events` only ever flows the other way: the github server
> writes it via `recordEvent`, and nothing here writes back to it.

## Pages

| Route | Shows |
| --- | --- |
| `/` | [`HarnessCard`](../../../control_panel/components/harness-card.tsx) — server/tool counts and permission-state badges across `permissions` ([`lib/servers.ts`](../../../control_panel/lib/servers.ts)'s `listServers()` + `lib/db.ts`'s `listAllPermissions()`) |
| `/servers/github` | The github server's tools, each with a [`PermissionControl`](../../../control_panel/components/permission-control.tsx), plus the [github profiles](#github-profiles) and [tokens](#tokens) managers |
| `/metrics` | The [event log dashboard](#metrics) — charts and a filterable table over `events` |

Every page exports `dynamic = "force-dynamic"` — the tables are read fresh on
every request rather than cached at build time, because the point of the app
is to reflect edits made through it.

`/servers/github` is a hand-written page, not a dynamic `/servers/[server]`
route — there is one server today, and each server is expected to get its own
manually authored page under `app/servers/<slug>/` rather than a shared
template, the same way [`github-server.md`](github-server.md) describes one
note per server rather than a generated one.

## Reading and writing permissions

- [`lib/github/tools.ts`](../../../control_panel/lib/github/tools.ts) exposes
  `getGithubTools()`, a function (not a constant) over
  [`lib/servers.ts`](../../../control_panel/lib/servers.ts)'s
  `findServerBySlug()` and [`lib/db.ts`](../../../control_panel/lib/db.ts)'s
  `listPermissions(serverId)` — a constant would freeze at whatever the rows
  looked like when the module first loaded, not the rows as they are now.
- A tool that exists in `TOOL_REGISTRATIONS` but has no migrated row simply
  does not appear. Nothing cross-references the two; see
  [data store](data-store.md#adding-a-migration).
- Edits go through
  [`/api/github_mcp_update_permission`](../../../control_panel/app/api/github_mcp_update_permission/route.ts):
  `PATCH { serverId, slug, state }` sets `state`, `DELETE { serverId, slug }`
  resets it to the row's seeded `default_state`. Both validate the body with
  `zod` and 404 when the row doesn't exist.
- [`PermissionControl`](../../../control_panel/components/permission-control.tsx)
  is a client component holding the pending edit versus the saved one, so
  "Save" is disabled until the two differ and "Reset" until the saved value
  differs from `default_state`.

## GitHub profiles

A `github_profiles` row is a named preset — `profile_name`, `repository_owner`,
`repository_name` — not a permission. `/servers/github` renders
[`AddProfileForm`](../../../control_panel/app/servers/github/components/add-profile-form.tsx)
and [`GithubProfilesTable`](../../../control_panel/app/servers/github/components/github_profiles_table.tsx)
below the tool list, both reading and writing through
[`app/servers/github/lib/github_profiles.tsx`](../../../control_panel/app/servers/github/lib/github_profiles.tsx):

- `listGithubProfiles()` maps rows into plain object literals before they
  reach a page — `node:sqlite`'s result rows aren't plain objects, and React
  rejects them when a Server Component passes them as props into a Client
  Component, the same rule `lib/servers.ts` follows for `servers`.
- `addGithubProfile(profileName, owner, repo)` inserts a row via
  [`/api/github_add_profile`](../../../control_panel/app/api/github_add_profile/route.ts)
  (`POST`), called from `AddProfileForm`, a client component holding the three
  input fields' state.
- `setGithubProfileActive(id, active)` is the one write with an invariant to
  keep: **at most one profile is active per server.** Turning a profile on
  runs `UPDATE github_profiles SET is_active = (id = ?) WHERE server_id = ?` —
  one statement that activates the target row and clears every other row for
  the same server at once, so there is no window where two rows both read
  active. It checks the row exists first, on the read-only connection, before
  writing — the activating statement's `WHERE` matches every row for the
  server rather than just `id`, so `changes > 0` alone can't tell a real
  toggle from a bogus `id` that just re-zeroed rows already at zero. Called
  through
  [`/api/github_set_active_profile`](../../../control_panel/app/api/github_set_active_profile/route.ts)
  (`PATCH`) by
  [`ProfileActiveToggle`](../../../control_panel/app/servers/github/components/profile-active-toggle.tsx),
  a client component wrapping the shadcn `Switch`, per row of the table.
- The github server now reads `is_active`:
  `tools/github/src/utils/get_repo_config.ts`'s `getActiveGithubProfile`
  selects the one row with `is_active = 1`, scoped by `server_id`, and
  `index.ts` uses its `repository_owner`/`repository_name` as
  `defaultOwner`/`defaultRepository` in `ServerConfig`. This lives in the
  github tool, not in `data/access.ts` — the table is specific to this one
  server, unlike `servers`/`permissions`, which every server shares.
  `defaultOwner`/`defaultRepository` are getters on `ServerConfig`, so a
  newly activated row is picked up on the *next tool call*, not just after a
  restart — see [MCP server](mcp-server.md#serverconfig).

## Tokens

An `env` row registers a root `.env` key as a named, typed token for a
server — never the secret value, which stays in `.env`. `/servers/github`
renders [`TokensManager`](../../../control_panel/components/tokens_manager.tsx),
which reads and writes through
[`control_panel/lib/tokens.ts`](../../../control_panel/lib/tokens.ts) and
[`control_panel/lib/env_file.ts`](../../../control_panel/lib/env_file.ts):

- `listEnvKeys()` (`lib/env_file.ts`) reads only the **key names** out of the
  root `.env` — it stops at the first `=` on each line and never holds a
  value in memory. A key suffixed `__<TYPE>` (e.g. `GITHUB_TOKEN_1__AUTH`)
  suggests that type when registering it.
- [`AddTokenForm`](../../../control_panel/components/add-token-form.tsx)
  lists `.env` keys not yet registered for this server
  (`listAvailableTokens`), lets the type be edited, and posts to
  [`/api/token_add`](../../../control_panel/app/api/token_add/route.ts)
  (`POST`), which calls `addToken(serverId, tokenName, type)` — the new row
  starts inactive.
- [`TokenActiveToggle`](../../../control_panel/components/token-active-toggle.tsx)
  wraps the shadcn `Switch` per row, calling
  [`/api/token_set_active`](../../../control_panel/app/api/token_set_active/route.ts)
  (`PATCH`), which calls `setTokenActive(id, serverId)` or
  `deactivateToken(id, serverId)`. Unlike `github_profiles`'s single
  `UPDATE ... WHERE server_id = ?`, `env`'s uniqueness is a **partial unique
  index** on `(server_id, type) WHERE is_active = 1` that checks per
  statement — so `setTokenActive` deactivates the sibling row and activates
  the target one as two statements in one transaction, not one, to avoid
  tripping the index mid-write. See [data store](data-store.md#env).
- `type` is deliberately free text (no `CHECK`) but every lookup and write
  compares it with `COLLATE NOCASE` — a real bug shipped without this (an
  `"AUTH"` row silently failed to match a lookup for `"auth"`); see
  [current plan](../../07-plans/current.md).
- The github server reads the active `auth`-type token the same way it reads
  the active profile: `data/access.ts`'s `getActiveTokenName("github",
  "auth")` is read fresh by a `ServerConfig` getter, so switching the active
  token takes effect on the next tool call, no restart. See
  [github server](github-server.md#configuration) and
  [MCP server](mcp-server.md#serverconfig).

## Metrics

`tools/shared/src/tracking.ts`'s `withTracking` wraps every github tool
handler, timing the call and writing one `events` row (server, resolved
tool, status, error message, duration) through `data/access.ts`'s
`recordEvent` — see [data store](data-store.md#events). `/metrics` reads
that table through
[`control_panel/lib/events.ts`](../../../control_panel/lib/events.ts),
read-only, filtered by an optional `?from=&to=` date range pushed down to
SQL rather than filtered in the browser:

- [`EventCharts`](../../../control_panel/app/metrics/components/event_charts.tsx)
  renders overview stat tiles and recharts-based volume/hits/latency charts
  through a shared [`ChartContainer`](../../../control_panel/components/ui/chart.tsx)
  (shadcn's chart primitive).
- [`EventsTable`](../../../control_panel/app/metrics/components/events_table.tsx)
  is a sortable, filterable, paginated table over the same rows
  (`@tanstack/react-table`), with a per-row detail sheet.

Nothing in the control panel writes to `events` — it is the one table here
that only the github server, not a human through this app, ever changes.

## `lib/db.ts` mirrors `data/access.ts` — sort of

Next's server code runs under **Node**, not Bun, and `bun:sqlite` /
`node:sqlite` are each available only in their own runtime — so
`control_panel/lib/db.ts` cannot import
[`data/access.ts`](../../../data/access.ts) directly. It restates the same
`SELECT_COLUMNS` and a `ToolPermission` shape by hand, plus two writers
`data/access.ts` has no reason to carry: `updateToolState` and
`resetToolState`, opened on a **separate, read-write** connection so the read
path used by every page stays `readonly: true`. `lib/servers.ts`, `lib/tokens.ts`
and `lib/events.ts` are the same kind of by-hand mirror for `servers`, `env`
and `events` respectively — see [data store](data-store.md#reading-and-writing-it),
which is where `data/access.ts` itself is described.

> [!note] Keep every `lib/` mirror in sync with the schema by hand
> A schema change to `permissions`, `servers`, `env` or `events` means editing
> the `SELECT` columns and the row type in both `data/access.ts` and whichever
> `control_panel/lib/` file mirrors that table. Nothing checks that they
> agree — `github_profiles` has no Bun-side reader at all, so it only has one
> copy to keep in sync.

## Dependencies live at the root too

[ADR-0005](../../03-decisions/ADR-0005-root-dependencies.md) applies to this
workspace exactly as to a server under `tools/`: `control_panel/package.json`
should declare no third-party package, only its identity and scripts. The
`shadcn` CLI does not know that — pointed at `--cwd control_panel` it reads
and writes `control_panel/package.json` directly and installs into a nested
`control_panel/node_modules/` that shadows the root. Run
[`scripts/rehome-panel-deps.mjs`](../../../scripts/rehome-panel-deps.mjs)
(`bun run rehome:panel`) after any `shadcn` command touches the panel: it
moves what the CLI wrote back to the root manifest (updating the range if the
package is already declared there, rather than duplicating it), deletes the
shadowing `node_modules/`, and reinstalls.
[`check-deps.mjs`](../../../scripts/check-deps.mjs) now resolves workspace
directories from the root `package.json`'s own `workspaces` field rather than
assuming everything lives under `tools/`, so `control_panel` gets the same
`DECLARED`/`SHADOWED` checks as any server.

`tsconfig.json` excludes `control_panel` — it has its own
`control_panel/tsconfig.json` — and `bun run typecheck` runs `tsc` against
both.

## Related

[Data store](data-store.md) ·
[MCP server](mcp-server.md) ·
[GitHub server](github-server.md) ·
[ADR-0005](../../03-decisions/ADR-0005-root-dependencies.md) ·
[ADR-0007](../../03-decisions/ADR-0007-writes-behind-declared-capability.md) ·
[current plan](../../07-plans/current.md)
