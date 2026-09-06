import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Node-native mirror of `data/access.ts`'s `permissions` reads. Next's server
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

export type ToolPermission = {
  id: number;
  server_id: number;
  slug: string;
  tool_effect: ToolEffect;
  description: string | null;
  /** The decision a permission layer would consult - editable, unlike `default_state`. */
  state: PermissionState;
  default_state: PermissionState;
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
  "id, slug, server_id, tool_effect, description, default_state, state";

/** Every row currently seeded in `permissions`, across every server. */
export function listAllPermissions(): ToolPermission[] {
  return getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM permissions`)
    .all() as ToolPermission[];
}

/** Every row currently seeded in `permissions` for one server. */
export function listPermissions(serverId: number): ToolPermission[] {
  return getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM permissions WHERE server_id = ?`)
    .all(serverId) as ToolPermission[];
}

/** One row by slug, or `null` if the tool has no row yet. */
export function findToolPermission(
  slug: string,
  serverId: number
): ToolPermission | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM permissions WHERE slug = ? AND server_id = ?`)
    .get(slug, serverId);
  return (row as ToolPermission | undefined) ?? null;
}

/**
 * Sets a tool's `state`. Returns `false` if `slug` has no row - the CHECK
 * constraint rejects anything outside `PermissionState` before this runs.
 */
export function updateToolState(
  serverId: number,
  slug: string,
  state: PermissionState,
): boolean {
  const result = getWritableDb()
    .prepare("UPDATE permissions SET state = ? WHERE slug = ? AND server_id = ?")
    .run(state, slug, serverId);
  return result.changes > 0;
}

/** Sets a tool's `state` back to its seeded `default_state`. */
export function resetToolState(slug: string, serverId: number): boolean {
  const result = getWritableDb()
    .prepare("UPDATE permissions SET state = default_state WHERE slug = ? AND server_id = ?")
    .run(slug, serverId);
  return result.changes > 0;
}
