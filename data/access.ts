import { Database } from "bun:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ServerDescriptor,
  ServerRow,
  toServerDescriptor,
} from "./models/ServerDescriptor";
import { ToolPermission } from "./models/PermissionType";

/**
 * Bun-only: `bun:sqlite` is a runtime built-in, not resolvable under Node.
 * Only import this from code that Bun itself executes - migration scripts,
 * MCP servers. control_panel runs under Node, so it has its own equivalent
 * in `control_panel/lib/db.ts` (using `node:sqlite`) rather than importing
 * this file - keep the two in sync if the schema changes.
 */
const DB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "harness.db");

let db: Database | undefined;

/**
 * Opens `harness.db` read-only on first use. Run `bun run migrate` first.
 *
 * Exported so a server can query its own tables directly - `github_profiles`
 * is github-specific and has no business being modelled here, but the
 * connection itself (path resolution, the singleton, the readonly flag) is
 * shared infrastructure every server needs the same way.
 */
export function getDb(): Database {
  if (!db) db = new Database(DB_PATH, { readonly: true, strict: true });
  return db;
}

const SERVER_ROWS =
  "id, slug, server_name, description, icon_name, icon_source";

export function listServers(): ServerDescriptor[] {
  const rows = getDb()
    .prepare(`SELECT ${SERVER_ROWS} FROM servers`)
    .all() as ServerRow[];

  return rows.map(toServerDescriptor);
}

/** One server row by slug, or `null` if it doesn't exist. */
export function findServerBySlug(slug: string): ServerDescriptor | null {
  const row = getDb()
    .prepare(`SELECT ${SERVER_ROWS} FROM servers WHERE slug = ?`)
    .get(slug) as ServerRow | undefined;

  return row ? toServerDescriptor(row) : null;
}

const PERMISSIONS_ROWS = `id, server_id, slug, tool_effect, description, state, default_state`

/** Every permissions. */
export function listToolPermissions(): ToolPermission[] {
  return getDb()
    .query<ToolPermission, []>(`SELECT ${PERMISSIONS_ROWS} FROM permissions`)
    .all();
}

/** One row by slug, or `null` if the tool has no row yet. */
export function findToolPermission(slug: string, server_slug: string): ToolPermission | null {
  let serverId = findServerBySlug(server_slug)?.id

  if (!serverId) return null;

  return getDb()
    .query<
      ToolPermission,
      [string, number]
    >(`SELECT ${PERMISSIONS_ROWS} FROM permissions WHERE slug = ? AND server_id = ?`)
    .get(slug, serverId);
}

/** One row by slug, or `null` if the tool has no row yet. */
export function isToolAllowed(slug: string, server_slug: string):boolean {
  let serverId = findServerBySlug(server_slug)?.id

  if (!serverId) return false;

  return getDb()
    .query<
      ToolPermission,
      [string, number]
    >(`SELECT ${PERMISSIONS_ROWS} FROM permissions WHERE slug = ? AND server_id = ?`)
    .get(slug, serverId)?.state == "allow" ? true : false;
}
