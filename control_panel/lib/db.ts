import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Node-native mirror of `data/access.ts`'s `github_mcp` reads. Next's server
 * code runs under Node, not Bun, and `bun:sqlite` / `node:sqlite` are each
 * only available in their own runtime - so this can't just import
 * `data/access.ts`. Keep the SELECT in sync with it if the schema changes.
 */

const DB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/harness.db",
);

export type PermissionState = "allow" | "deny" | "ask";
export type ToolEffect = "read" | "write" | "destructive";

export type GithubToolPermission = {
  slug: string;
  server_name: string;
  server_effect: ToolEffect;
  summary: string | null;
  known_defects: string | null;
  default_state: PermissionState;
  /** The decision a permission layer would consult - editable, unlike `default_state`. */
  state: PermissionState;
};

let db: DatabaseSync | undefined;

/** Opens `harness.db` read-only on first use. Run `bun run migrate` first. */
function getDb(): DatabaseSync {
  if (!db) db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

let writableDb: DatabaseSync | undefined;

/** Opens `harness.db` read-write on first use. Only for code that mutates `state`. */
function getWritableDb(): DatabaseSync {
  if (!writableDb) writableDb = new DatabaseSync(DB_PATH);
  return writableDb;
}

const SELECT_COLUMNS =
  "slug, server_name, server_effect, summary, known_defects, default_state, state";

/** Every row currently seeded in `github_mcp`. */
export function listGithubToolPermissions(): GithubToolPermission[] {
  return getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM github_mcp`)
    .all() as GithubToolPermission[];
}

/** One row by slug, or `null` if the tool has no row yet. */
export function findGithubToolPermission(
  slug: string,
): GithubToolPermission | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM github_mcp WHERE slug = ?`)
    .get(slug);
  return (row as GithubToolPermission | undefined) ?? null;
}

/**
 * Sets a tool's `state`. Returns `false` if `slug` has no row - the CHECK
 * constraint rejects anything outside `PermissionState` before this runs.
 */
export function updateGithubToolState(
  slug: string,
  state: PermissionState,
): boolean {
  const result = getWritableDb()
    .prepare("UPDATE github_mcp SET state = ? WHERE slug = ?")
    .run(state, slug);
  return result.changes > 0;
}

/** Sets a tool's `state` back to its seeded `default_state`. */
export function resetGithubToolState(slug: string): boolean {
  const result = getWritableDb()
    .prepare("UPDATE github_mcp SET state = default_state WHERE slug = ?")
    .run(slug);
  return result.changes > 0;
}
