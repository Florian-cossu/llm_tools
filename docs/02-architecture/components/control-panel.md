---
type: component
status: active
scope: repo
last_reviewed: 2026-09-06
last_updated: 2026-09-06
summary: A Next.js app that reads and edits data/harness.db's permission and github_profiles tables - storage only, it gates nothing.
read_when:
  - working on control_panel
  - wondering whether the permission layer exists yet
  - a shadcn command changed control_panel/package.json
  - working on github profiles or the active-profile toggle
code_refs:
  - control_panel/lib/db.ts
  - control_panel/lib/servers.ts
  - control_panel/lib/github/tools.ts
  - control_panel/app/servers/github/page.tsx
  - control_panel/app/servers/github/lib/github_profiles.tsx
  - control_panel/app/api/github_mcp_update_permission/route.ts
  - control_panel/app/api/github_add_profile/route.ts
  - control_panel/app/api/github_set_active_profile/route.ts
  - scripts/rehome-panel-deps.mjs
tags:
  - component
  - control-panel
  - permissions
  - nextjs
---

# Control panel

`control_panel/` is a Next.js app that lets a human read and edit
`permissions`, the per-tool permission table, and `github_profiles`, a set of
named owner/repo presets for the github server, both in
[`data/harness.db`](data-store.md). It is a workspace member
(`@llm-tools/control-panel` in the root `workspaces` array), run with:

```bash
bun run dev:panel
```

> [!warning] It gates nothing
> Editing a tool's `state` here writes to the same row the permission layer
> would eventually consult. **Nothing reads it yet.** The github server's
> `GITHUB_ALLOW_WRITES` remains the entire gate, exactly as before this app
> existed — see [current plan](../../07-plans/current.md). This app is a
> viewer and editor for storage, not the permission layer ADR-0007 describes.
> `github_profiles` isn't consulted anywhere either — nothing in the github
> server reads which profile is active yet.

## Pages

| Route | Shows |
| --- | --- |
| `/` | Every server, tool and state counts across `permissions` ([`lib/servers.ts`](../../../control_panel/lib/servers.ts)'s `listServers()` + `lib/db.ts`'s `listAllPermissions()`) |
| `/servers/github` | The github server's tools, each with a [`PermissionControl`](../../../control_panel/components/permission-control.tsx), plus the [github profiles](#github-profiles) manager |

Both pages export `dynamic = "force-dynamic"` — the tables are read fresh on
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
- Same as permissions: nothing in the github server reads `is_active` yet.
  The profile a tool call would actually use is still whatever the server's
  own config says.

## `lib/db.ts` mirrors `data/access.ts` — sort of

Next's server code runs under **Node**, not Bun, and `bun:sqlite` /
`node:sqlite` are each available only in their own runtime — so
`control_panel/lib/db.ts` cannot import
[`data/access.ts`](../../../data/access.ts) directly. It restates the same
`SELECT_COLUMNS` and a `ToolPermission` shape by hand, plus two writers
`data/access.ts` has no reason to carry: `updateToolState` and
`resetToolState`, opened on a **separate, read-write** connection so the read
path used by every page stays `readonly: true`.

> [!warning] `data/access.ts` is stale, not just separate
> It still targets the old `github_mcp` table this schema replaced with
> `servers` + `permissions` — see [data store](data-store.md#reading-and-writing-it).
> "Mirrors" describes the intent, not today's reality; `lib/db.ts` is the one
> of the two that actually matches `harness.db` as migrated now.

> [!note] Keep `lib/db.ts` in sync with the schema by hand
> A schema change to `permissions` means editing `SELECT_COLUMNS` and the type
> in `lib/db.ts` (and, once someone fixes it, `data/access.ts`). Nothing checks
> that they agree.

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
[ADR-0005](../../03-decisions/ADR-0005-root-dependencies.md) ·
[ADR-0007](../../03-decisions/ADR-0007-writes-behind-declared-capability.md) ·
[current plan](../../07-plans/current.md)
