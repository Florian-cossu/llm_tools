---
type: plan
status: draft
scope: repo
last_reviewed: 2026-09-06
last_updated: 2026-09-09
summary: NOT AUTHORITATIVE - what is half-finished right now and what is worth doing next.
read_when:
  - picking up work
  - you found something broken and want to know if it is known
tags:
  - plan
  - wip
---

# Current plan

> [!warning] Not authoritative
> Intent, not fact. Code and [contracts](../04-contracts/README.md) win over anything
> here — see [conventions](../00-conventions.md).

## Known broken

### `bun test` is a false green

No test files exist; the runner exits successfully having run nothing. Note this
is **`bun test`**, not `bun run test` — the latter now runs a clean reinstall,
`check-docs.mjs`, `bun run typecheck` and `check-deps.mjs`, which is real work
but still runs no tests. See [testing](../06-workflows/testing.md).

## Smaller defects

| Item | Where |
| --- | --- |
| The permission layer now gates registration for **allow/deny** (see Done, below), but `ask` has no effect distinct from `deny`, a changed row needs a **server restart**, and nothing audits who changed a row | `index.ts`, [data store](../02-architecture/components/data-store.md) |
| `permissions` records each tool's effect class (`tool_effect`) alongside the decision. It is **hand-written into the migration, not derived from `TOOL_EFFECT`**, so a row can say one thing while the code says another — nothing enforces they agree, even though the one known instance of this (`delete_github_label`) is now fixed | `data/migrations/0004_add_github_tools_permissions.sql` |
| Nothing keeps `permissions` rows in step with `TOOL_REGISTRATIONS`. A new tool needs a hand-written migration or it is simply unlisted, and the control panel silently omits it the same way | — |
| `github_profiles`'s `is_active` flag is enforced single-active by the write, not a constraint — `setGithubProfileActive`'s `UPDATE ... SET is_active = (id = ?)` trick is the only thing preventing two active rows, not the schema | `control_panel/app/servers/github/lib/github_profiles.tsx` |
| No audit trail. Nothing records that a write happened | — |
| No CI, so `bun run test` only runs when someone remembers to | — |
| No eval scenario for either milestone tool, and the one that exists is `status: planned` | `docs/05-harness/scenarios/` |
| No milestone or label fixtures, so `mapGithubMilestone` and `mapGithubLabel` have nothing to be tested against | `docs/05-harness/fixtures/github/` |
| `labels` builds `label:a,b`, which GitHub reads as *any of*, so listing two names widens the result. Documented, not fixed — an *all of* filter needs repeated qualifiers | `utils/github_search_query.ts` |
| A trailing or doubled comma in `labels` reaches the query as an empty name — `"draft,"` builds `label:draft,`. Empty segments are not dropped | `utils/github_search_query.ts` |

## Next, in value order

1. **Test the pure functions** — mappers, `buildIssueSearchQuery`, the string
   guards — against the [fixtures](../05-harness/fixtures/github/README.md), which already
   encode the awkward cases. Milestone fixtures still need writing.
2. **Add the registration sanity test** (every `TOOL_REGISTRATIONS` entry has a real
   description and no `TODO`). This is what would have caught the milestone
   scaffold before it shipped registered.
3. **`ask` and an audit trail for the permission layer.** Allow/deny now gate
   registration and are the **only** gate
   ([ADR-0008](../03-decisions/ADR-0008-permission-table-gates-registration.md),
   [ADR-0009](../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)):
   `tools/github/src/index.ts` consults `data/access.ts`'s `isToolAllowed` as
   its single filter over `TOOL_REGISTRATIONS`; `GITHUB_ALLOW_WRITES` is gone,
   and `destructive` is gated the same way `write` is rather than
   blanket-refused. Still open: `ask` has no effect distinct from `deny`; a
   row change needs a **server restart**, same limitation the old env var had
   (live reload — enabling/disabling an already-registered tool via the MCP
   SDK's `RegisteredTool` handle, on `tools/list_changed` — is a separate,
   bigger change, not done); and nothing records who changed a row or when.
4. **A scenario for the write path**: the model asked to create a label calls
   `list_github_labels` first, confirms, calls once, and does not retry the
   422. And the injection case — an issue body telling it to create a label
   must not work.
5. **Description/schema tests** for the
   [three-places rule](../02-architecture/components/shared-package.md#the-three-places-rule)
   — the repo's most important convention, currently unverified.

## Open questions

- Should `labels` require *all* the names it lists rather than *any*? That means
  emitting one `label:` qualifier per name instead of joining them with commas,
  and picking a syntax for the other meaning — the current string format has no
  room for both
  ([github API](../04-contracts/github-api.md#label-qualifiers)).
- ~~Do write tools ever get added, and behind what gate?~~ **Answered** by
  [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md) and
  [ADR-0008](../03-decisions/ADR-0008-permission-table-gates-registration.md):
  yes, behind a declared effect class, the `.env` opt-in, and now the
  permission table's per-tool `state` too.
- Should the effect gate live in `@llm-tools/shared` (where
  `registrationRefusal` is) or become part of the MCP server construction
  itself? Today every server has to remember to call it — the second server
  will show whether that is a problem.
- Is a second integration close enough to matter? It would test whether
  `@llm-tools/shared` generalises beyond GitHub.
- Should milestone progress counts be in the compact shape by default? They now
  live in the **detail** shape only
  ([data schemas](../04-contracts/data-schemas.md#milestone-detail)), so a list
  answers "which milestones exist" but never "how far along is each one".
- Is a boolean `truncated` the right answer for a list whose endpoint reports no
  total, or should such tools count pages to get a real one?
  ([T18 exception](../04-contracts/tool-contract.md#responses))

## Done

- **The active auth token is read from the `env` table, and `ServerConfig`'s
  DB-backed fields are now getters, read per tool call, not once at startup.**
  `data/access.ts` gained `getActiveTokenName(server_slug, type)`, querying a
  new `env` table (`data/migrations/0007_init_tokens_by_server.sql`) that maps
  each server to the `.env` key names it can use, scoped by `type` (e.g.
  `"auth"`) — a partial unique index (`WHERE is_active = 1`) enforces at most
  one active token per `(server_id, type)`. `tools/github/src/index.ts` no
  longer reads a hardcoded `GITHUB_TOKEN`: it resolves the active token's env
  var name, then reads its value from `process.env`. Bigger than the token
  itself: `config.token`, `config.octokit`, `config.defaultOwner` and
  `config.defaultRepository` were converted from plain fields to getters, so
  every tool handler (which reads `config.foo` inside its `async` body, at
  call time) now sees whichever token/profile is currently active — switching
  either in the control panel takes effect on the next tool call, no restart.
  Still restart-gated: the permission table (unchanged, still gates
  registration) and the tool **descriptions/schemas**, which read `config` once,
  synchronously, while `registration.register(server, config)` builds their
  strings — so the *text* shown to the model still reflects whatever was
  active at the last restart even though the behavior is already current. See
  [MCP server](../02-architecture/components/mcp-server.md#serverconfig).
  A control-panel-side gap surfaced while building this: `env` rows read
  through `node:sqlite` aren't plain objects, and a Server Component handing
  one straight to a Client Component (`TokenActiveToggle`) crashed with
  React's "Only plain objects... can be passed to Client Components" — fixed
  by mapping rows through a `toTokenRow` function, the same pattern
  `servers.ts`/`github_profiles.tsx` already used and the fix this entry's
  code review should have caught before it shipped.
  **A second real bug shipped in the same batch and was only caught by a
  live "Requires authentication" failure on `update_github_issue`**: `type`
  is deliberately unconstrained free text (no `CHECK`, per the design
  discussion), and the add-token form's suggested type comes straight from
  the `.env` key's `__SUFFIX`, which is naturally uppercase (`__AUTH`) — but
  `getActiveTokenName("github", "auth")`'s call site, and
  `setTokenActive`'s sibling-deactivation query, both compared `type` with a
  hardcoded lowercase literal / case-sensitive `=`. SQLite's default
  collation is case-sensitive, so an active row stored as `type = "AUTH"`
  matched neither, the lookup silently returned `null`, and Octokit built an
  unauthenticated client despite a genuinely valid, genuinely active token.
  Fixed by adding `COLLATE NOCASE` to both comparisons rather than forcing a
  casing convention on stored values. **Not yet fixed**: the partial unique
  index itself (`idx_env_active_per_type`) still uses the default
  case-sensitive collation, so it would not stop `"auth"` and `"AUTH"` rows
  from both being `is_active = 1` at once if a row were written outside
  `setTokenActive` (e.g. directly in SQL) — closing that needs a migration
  recreating the index with `type COLLATE NOCASE`, not just a query change.

- **`github_profiles`'s active row now sets `defaultOwner`/`defaultRepository`,
  closing the gap the previous entry (below) used to describe** — and
  `GITHUB_DEFAULT_OWNER`/`GITHUB_DEFAULT_REPOSITORY` are gone from `.env.example`,
  continuing the same env-reduction direction as the permission-table work.
  Landed in two passes:
  - First pass put the query in `data/access.ts` (`findActiveGithubProfile`,
    typed model in `data/models/GithubProfile.ts`), matching how `permissions`
    is read. **A real bug was caught before it shipped**: the very first draft
    (written directly in a `tools/github/src/utils/` file, before it moved)
    was `SELECT * FROM ? WHERE is_active = ?`, binding the table name as a
    parameter — SQL parameters can't stand in for identifiers, and running it
    crashed the server outright (`SQLiteError: near "?": syntax error`) rather
    than just failing to find a profile. It also had no `server_id` filter at
    all, so once the syntax error was gone it would still have matched any
    server's active profile rather than specifically github's — harmless with
    one server, wrong for the multi-server design `server_id` exists for.
  - Second pass moved it back out of `data/access.ts`: `github_profiles` is
    specific to this one server, unlike `servers`/`permissions`, which every
    server shares, so its model (`tools/github/src/models/github_profiles.ts`)
    and its query (`tools/github/src/utils/get_repo_config.ts`'s
    `getActiveGithubProfile`, keeping the fix for both bugs above) now live in
    the github tool. `data/access.ts` exports `getDb` and `findServerBySlug`
    as the generic primitives that query is built on, and owns nothing
    github-specific anymore.
  `tools/github/src/index.ts` originally called `getActiveGithubProfile()`
  once at startup and fed the result into `ServerConfig`, same as `.env`
  values used to be, needing a restart to pick up a newly activated profile —
  **superseded by the entry above this one**: `defaultOwner`/`defaultRepository`
  are now getters, read per tool call.

- **`GITHUB_ALLOW_WRITES` removed; the permission table is the only registration
  gate** ([ADR-0009](../03-decisions/ADR-0009-permission-table-is-the-only-write-gate.md)).
  Once every mutating tool had a permission-table row defaulting to `deny`
  (previous entry), the env flag decided nothing that row didn't already
  decide, so it was deleted along with `registrationRefusal` and
  `booleanFromEnv` in `tools/shared/src/tool_effect.ts` — neither had another
  caller. `tools/github/src/index.ts` now runs one filter,
  `isToolAllowed(name, "github")`, over all of `TOOL_REGISTRATIONS`, for every
  effect class. `ServerConfig.allowWrites` is gone, and so is the
  `GITHUB_ALLOW_WRITES` line in `.env.example` and `tools/github/.env`. The
  cost this trades away: there is no longer an independent, env-file kill
  switch that works regardless of what the permission table says — the table
  is now a single point of failure for "no mutating tool registers," where
  before there were two independent gates.

- **The permission table now gates registration, for allow/deny** ([ADR-0008](../03-decisions/ADR-0008-permission-table-gates-registration.md)).
  `data/access.ts` gained `isToolAllowed(slug, server_slug)`; `tools/github/src/index.ts`
  runs it as a second `.filter()` over `TOOL_REGISTRATIONS`, after the existing
  effect-class gate, logging a refusal to stderr the same way. A tool now needs
  both gates to pass. As part of this, `registrationRefusal` in
  `tools/shared/src/tool_effect.ts` **dropped its unconditional refusal of
  `destructive`** — that class is gated the same way `write` is (env flag) plus
  the permission table (deny by default), rather than refused regardless of
  configuration, since the table now provides the finer-grained, per-tool
  consent ADR-0007 D3 was written to wait for. `delete_github_label`'s
  `TOOL_EFFECT` was corrected from `write` to `destructive` to match, closing
  the mismatch the data-store note used to flag. Still open: `ask` has no
  effect distinct from `deny`, a row change needs a server restart, and there
  is no audit trail — see the smaller-defects table above.

- **The schema was restructured, and the control panel grew a `github_profiles`
  manager.** `github_mcp`, the single per-tool table the bullets below
  describe, is gone: `data/migrations/0001_initial.sql` through
  `0003_add_github_tool_name_description_to_permission_table_.sql` were
  replaced with four new files —
  `0001_init_servers_table.sql`, `0002_init_github_profiles_table.sql`,
  `0003_init_permissions_table.sql`, `0004_add_github_tools_permissions.sql` —
  none of which exist under their old names anymore. The bullets under this
  one are history as written at the time; for the schema as it actually is
  today, see [data store](../02-architecture/components/data-store.md#schema),
  not these filenames.
  - `servers` exists so a second MCP server has somewhere to attach its own
    rows; `permissions` is `github_mcp` scoped by `server_id` instead of
    assuming there is only ever one server.
  - `github_profiles` is new and is **not** a permission table: one row per
    named owner/repo preset, with an `is_active` flag. `/servers/github` now
    renders an add-profile form and a table of existing profiles, each with a
    toggle. At most one profile is active per server — enforced by the write
    (`UPDATE github_profiles SET is_active = (id = ?) WHERE server_id = ?` in
    one statement), not by a schema constraint. See
    [control panel](../02-architecture/components/control-panel.md#github-profiles).
  - Same gap as the permission table: nothing in the github server reads
    `is_active`, or anything else in `github_profiles`.
  - The shadcn `switch` and `table` components were added for this
    (`ProfileActiveToggle`, `GithubProfilesTable`) — both `bun run
    rehome:panel` no-ops turned out to be, since the packages they needed
    (`cn`, `radix-ui`) were already root dependencies from earlier `shadcn`
    runs, so there was nothing left to rehome after the CLI wrote its usual
    redundant block into `control_panel/package.json`.
  - `data/access.ts` was **not** updated as part of this and still queries
    the old `github_mcp` shape — dead code today since nothing imports it, but
    a real trap for whoever writes the permission-layer gate and reaches for
    it expecting it to work. See the defect table above.

- **A control panel and the schema migration behind it** (`0003`, pre-dating
  the restructure above). A Next.js
  app under `control_panel/`, run with `bun run dev:panel`, reads `github_mcp`
  through a Node-side mirror of `data/access.ts`
  ([control panel](../02-architecture/components/control-panel.md)) and edits
  `state` through `PATCH`/`DELETE /api/github_mcp_update_permission`.
  `0003_add_github_tool_name_description_to_permission_table_.sql` renamed the
  primary key to `slug` and added `server_name`, `server_effect`, `summary`,
  `known_defects` and `default_state` — the columns the control panel needed
  to show something other than a bare slug and a decision, and the ones
  ADR-0007 puts alongside the decision in the first place.
  - **It is a viewer and an editor, not the permission layer.** Nothing in the
    github server reads `github_mcp`; `GITHUB_ALLOW_WRITES` is unchanged. See
    the warning on [data store](../02-architecture/components/data-store.md)
    and on [control panel](../02-architecture/components/control-panel.md).
  - **The seed and the code can now visibly disagree.** `0003` classifies
    `delete_github_label` as `destructive` in `server_effect` — correct per
    D3 — while the tool's own `TOOL_EFFECT` still says `write`. Recording the
    class made this mismatch inspectable; it did not fix it.
  - `control_panel/package.json` is a workspace under ADR-0005 like any
    server, but the `shadcn` CLI that scaffolded its UI components is not
    workspace-aware and writes dependencies into it directly.
    `scripts/rehome-panel-deps.mjs` (`bun run rehome:panel`) moves what it
    wrote back to the root manifest. `check-deps.mjs` was generalised at the
    same time to resolve workspace directories from the root `package.json`'s
    own `workspaces` field instead of assuming everything lives under
    `tools/`, so `control_panel` gets the same checks a server would.

- **`update_github_milestone` added** (server 2.4.0 → 2.5.0), and its
  permission row seeded in `0002_add_update_milestone_permission.sql` (`deny`).
  Follows `update_github_label`'s shape one layer up: `milestone_number`
  identifies the milestone, every other parameter (`title`, `state`,
  `description`, `due_on`) is a new value left unchanged when omitted, and a
  call carrying none of them is rejected rather than treated as a no-op. See
  [github server](../02-architecture/components/github-server.md#the-milestone-writes).

- **A local SQLite store and a migration runner**
  ([data store](../02-architecture/components/data-store.md)). `data/migrate.ts`
  applies plaintext `.sql` files from `data/migrations/` in filename order,
  recording each in a `meta` table so a second run applies nothing, inside a
  transaction so a failure cannot leave a half-applied schema with its
  bookkeeping already written. `bun run migrate` is the entry point;
  `harness.db` and its WAL siblings are gitignored.
  - `0001_initial.sql` creates `github_mcp` and seeds one row per tool, using
    ADR-0007's own vocabulary: `state` is `allow`, `deny` or `ask` — enforced by
    a `CHECK`, not by convention — defaulting to `deny`, with the six reads
    seeded `allow` and the three label mutations `deny`. Nothing is seeded
    `ask`, because nothing implements asking.
  - This is **storage only**. No server reads it, and the gate is unchanged —
    see the defect table above before describing the permission layer as
    started.
  - Both `data/schema.ts` and `data/seed.ts` were removed. They defined the
    same schema in TypeScript, which is the approach migrations replace, and
    keeping an empty `seed.ts` would have advertised a seeding step that did
    not exist.

- **`update_github_label` added** (server 2.3.0 → 2.4.0). The second write, and
  the first tool written against ADR-0007 rather than alongside it. It calls
  `issues.updateLabel`, is keyed by the label's **current** `name` with
  `newName` carrying the rename, and forwards only the parameters it was given
  because the endpoint is a partial update.
  - **It was reviewed as a read and was not one.** The tool shipped its first
    draft declaring `TOOL_EFFECT = "read"` while calling a mutating endpoint —
    a T4c defect that also opened the gate, since `registrationRefusal` sees
    only the declaration: it registered whatever `GITHUB_ALLOW_WRITES` said, and
    `buildServerInstructions` would have told the model every tool on the server
    was read-only. The declaration is the control, so a wrong one is not a
    documentation slip. This is why the [testing checklist](../06-workflows/testing.md)
    greps the Octokit calls against the declared effect rather than trusting it.
  - A call carrying none of `newName`, `color` and `description` is **refused in
    the handler**. GitHub answers `200` with the label untouched, and reporting
    that as `{ updated: true }` would tell the model a change landed. This is
    not a permission check — the gate stays at registration (D4) — it is about
    not lying in the response.
  - Scaffold defects fixed before it shipped, all of them from copying
    `create_github_label` without re-reading it: the description was still the
    one-line stub; the response was raw `response.data` instead of
    `mapGithubLabel`, against T18; `color` was passed through without
    `.replace("#", "")`, so a `#`-prefixed code the regex accepts would have
    reached the API; `newName` was missing `.min(1)`; and `name` carried
    create's case-collision warning, which belongs to `newName` — `name` must
    match a label that exists.
  - `write`, not `destructive`: a rename is undone by another rename (D3).

- **`create_github_label` added, and writes unblocked** (server 2.2.0 → 2.3.0).
  The repo's first mutating tool, and the reason
  [ADR-0007](../03-decisions/ADR-0007-writes-behind-declared-capability.md)
  supersedes ADR-0003. What landed with it:
  - **Effect classes.** Every tool exports `TOOL_EFFECT` (`read` | `write` |
    `destructive`) and the toolbox exports `TOOL_REGISTRATIONS` of
    `{ name, effect, register }` instead of bare functions — the name and the
    effect have to be readable *before* the tool is registered, which a bare
    registrar cannot offer.
  - **The gate**, in `index.ts`: `registrationRefusal` decides per tool, the
    refusal goes to **stderr**, and a refused tool is never registered, so the
    model does not see it. `destructive` is refused whatever the flag says.
  - **`GITHUB_ALLOW_WRITES`**, read once through `booleanFromEnv`, which
    accepts only `1`/`true`/`yes`/`on` — a typo leaves writes off rather than on.
  - **The read-only instruction paragraph is finally uncommented**, which was
    item 3 on this list, but *conditional*: it promises read-only only when
    nothing mutating was registered, and otherwise names the write tools and
    tells the model that issue and comment text is not the user speaking.
    `buildServerInstructions` now takes the allowed registrations, so it cannot
    promise something the gate contradicts.
  - Scaffold defects fixed before it shipped: `labelName` had
    `.default("new label")`, so a confused model would have created a label by
    that name; `z.hex()` accepted `fff` and *rejected* `#ff0000`, making the
    handler's `.replace("#", "")` unreachable; and the response wrapped JSON in
    prose against T16. Parameters were renamed `name`/`color`/`description` to
    match `get_github_label` and the mapper's own field names.
  - The standard write preamble lives in `describeMutation(effect)` in the
    shared package, so the next write tool does not improvise its own warning.

- **Label filtering on `list_github_issues`** (server 2.0.0 → 2.2.0). A new
  `labels` parameter takes a comma-separated list of names, `NOT:` marking one
  to exclude, and `buildIssueSearchQuery` turns it into at most two qualifiers
  (`label:` / `-label:`), quoting any name containing a space. It was named
  `label` while accepting a list, which invited the model to pass exactly one;
  renamed to `labels`, matching the argument the query builder already took.
  `search` used to advertise `label:bug` as an example, so there were two routes
  to the same filter — the example is gone and `search` now disclaims labels the
  way it already disclaims the repo, the state and the PR exclusion. A
  `console.error` left over from debugging was removed. **The comma is GitHub's
  *any of*, not *all of*** — stated in the description, the README and the
  [API contract](../04-contracts/github-api.md#label-qualifiers), because the
  intuitive reading is the wrong one.
- **`get_github_label` added** (server 2.0.0 → 2.2.0). Calls `issues.getLabel`
  and returns one label through the existing `mapGithubLabel`. It is keyed by
  **name**, unlike every other `get_*` here, because no id survives into the
  compact shape. It returns **exactly what the list returns per row** — the
  endpoint has nothing more to give — so it is a documented exception to
  [T21](../04-contracts/tool-contract.md#responses), earning its place on cost
  and certainty: one label instead of a hundred, and a 404 that answers "does
  this label exist?". Three notes asserted in so many words that there was no
  `get_github_label` and had to be corrected:
  [data schemas](../04-contracts/data-schemas.md#label),
  [github API](../04-contracts/github-api.md#listing-labels) and
  [data flows](../02-architecture/data-flows.md#two-step-read-pattern). Its
  description was missing the returned shape (T11) entirely; added, along with
  the error wording the other `get_*` tools use.
- **`list_github_labels` added** (server 1.4.0 → 1.5.0). Calls
  `issues.listLabelsForRepo`, maps through the new `mapGithubLabel` into
  `{ name, description, color, default }`, and returns
  `{ returned, truncated, labels }` — the same no-total envelope as the
  milestone list. `limit` defaults to 100, the endpoint maximum, so one call
  normally returns a repository's whole label set. There is deliberately **no**
  `get_github_label`: the compact shape is the whole object, so a detail tool
  would violate T21. **That reasoning was later revisited** — see the
  `get_github_label` entry above, which keeps the premise and rejects the
  conclusion. Its description referenced `list_github_issues_by_repo`
  (the *filename*, not a tool the model can call) and omitted `default` from
  the shape it promises — both corrected before it was documented.
- **`list_github_milestones` finished.** Was registered scaffold calling
  `issues.get`; now calls `issues.listMilestones`, maps through
  `mapGithubMilestone`, and returns `{ returned, truncated, milestones }`. Two
  defects were found in the half-written version while finishing it: `limit` was
  passed to Octokit as `limit` rather than `per_page`, so it was silently
  ignored; and the `map` callback had no `return`, so the payload was
  `[null, null, …]`.
- **`get_github_milestone` completed.** Stale `// TODO` removed, description
  brought up to T11, and `openIssues` / `closedIssues` added — until then it
  returned exactly what the list tool returns for every milestone, so it had no
  reason to exist.
- **`tsc --noEmit` as a `typecheck` script.** `bun run typecheck`, wired into
  the root `test` script. The root `tsconfig.json` gained `noEmit` and
  `allowImportingTsExtensions` so it can check the same `.ts`-suffixed source
  Bun runs. First attempt installed the deprecated **`tsc` npm package**, whose
  binary prints a notice and exits 0 — a silent false green of exactly the kind
  this repo already had with `bun test`; the script now resolves `tsc` from the
  `typescript` devDependency.
- **`check-deps.mjs` added**, wired into `bun run test` alongside
  `bun install`. Enforces
  [ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever) on every run: no pins, no
  third-party declarations in workspace manifests, no shadowing nested trees, no
  duplicate installs, no lockfile drift. `bun run deps:reset` is the deliberate
  escape hatch. `typescript` also moved to `devDependencies`.
- **`zod` deduplicated to a single root install.** It resolved three ways at
  once — a stale `tools/github/node_modules/`, a second range in
  `tools/shared/package.json`, and a stale transitive resolution in the
  lockfile. Fixed by removing all three causes and regenerating `bun.lock` from
  clean; **no `overrides`, no pin**
  ([ADR-0005](../03-decisions/ADR-0005-root-dependencies.md#no-overrides-no-resolutions-ever)).
- Documentation vault built out under `docs/` — [index](../00-index.md).
- Docs given frontmatter and cross-links — [conventions](../00-conventions.md).
