import { Database } from "bun:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bun-only: `bun:sqlite` is a runtime built-in, not resolvable under Node.
 * Only import this from code that Bun itself executes - migration scripts,
 * MCP servers. control_panel runs under Node, so it has its own equivalent
 * in `control_panel/lib/db.ts` (using `node:sqlite`) rather than importing
 * this file - keep the two in sync if the schema changes.
 */

const DB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "harness.db");

/** The CHECK (state IN (...)) vocabulary on `github_mcp.default_state`. */
export type PermissionState = "allow" | "deny" | "ask";

/** The CHECK (server_effect IN (...)) vocabulary on `github_mcp.server_effect`. */
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

let db: Database | undefined;

/** Opens `harness.db` read-only on first use. Run `bun run migrate` first. */
function getDb(): Database {
  if (!db) db = new Database(DB_PATH, { readonly: true, strict: true });
  return db;
}

const SELECT_COLUMNS =
  "slug, server_name, server_effect, summary, known_defects, default_state, state";

/** Every row currently seeded in `github_mcp`. */
export function listGithubToolPermissions(): GithubToolPermission[] {
  return getDb()
    .query<GithubToolPermission, []>(`SELECT ${SELECT_COLUMNS} FROM github_mcp`)
    .all();
}

/** One row by slug, or `null` if the tool has no row yet. */
export function findGithubToolPermission(
  slug: string,
): GithubToolPermission | null {
  return getDb()
    .query<
      GithubToolPermission,
      [string]
    >(`SELECT ${SELECT_COLUMNS} FROM github_mcp WHERE slug = ?`)
    .get(slug);
}
