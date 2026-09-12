import { findServerBySlug, getDb, getWritableDb } from "@llm-tools/data";
import { type EnvKeyEntry, listEnvKeys } from "./env_file";

/**
 * `env`, the table mapping each server to the env var names (never values -
 * see `data/migrations/0007_init_tokens_by_server.sql`) it can use, scoped
 * by `type` (e.g. `"auth"`). Control-panel-only - no MCP server needs this
 * CRUD, so it lives next to the routes that use it rather than in
 * `@llm-tools/data`, on the shared connection `getDb`/`getWritableDb` open.
 */

export type TokenRow = {
  id: number;
  server_id: number;
  token_name: string;
  type: string;
  is_active: number;
};

const SELECT_COLUMNS = "id, server_id, token_name, type, is_active";

/**
 * Maps into a plain object literal - `bun:sqlite`'s result rows aren't
 * plain objects, and React rejects them when a Server Component passes them
 * as props into a Client Component.
 */
function toTokenRow(row: TokenRow): TokenRow {
  return {
    id: row.id,
    server_id: row.server_id,
    token_name: row.token_name,
    type: row.type,
    is_active: row.is_active,
  };
}

/** Every token row for one server, or `null` if the server doesn't exist. */
export function fetchTokenByServerSlug(slug: string): TokenRow[] | null {
  const serverId = findServerBySlug(slug)?.id;

  if (!serverId) return null;

  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM env WHERE server_id = ?`)
    .all(serverId) as TokenRow[];

  return rows.map(toTokenRow);
}

/**
 * Activates one token, deactivating any other active token of the same
 * `type` for the same server - disable then enable, as two statements in one
 * transaction. The partial unique index on `(server_id, type) WHERE
 * is_active = 1` checks immediately per statement, so flipping every row in
 * a single UPDATE (the way `setGithubProfileActive` does for
 * `github_profiles`, which has no such index) could conflict depending on
 * the order SQLite happens to visit matching rows in. Returns `false` if
 * `id` doesn't match a row for `serverId`.
 */
export function setTokenActive(id: number, serverId: number): boolean {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM env WHERE id = ? AND server_id = ?`)
    .get(id, serverId) as TokenRow | undefined;

  if (!row) return false;

  const wdb = getWritableDb();
  wdb.exec("BEGIN");
  try {
    wdb
      .prepare(
        `UPDATE env SET is_active = 0 WHERE server_id = ? AND type = ? COLLATE NOCASE AND is_active = 1`,
      )
      .run(serverId, row.type);
    wdb.prepare(`UPDATE env SET is_active = 1 WHERE id = ?`).run(id);
    wdb.exec("COMMIT");
  } catch (err) {
    wdb.exec("ROLLBACK");
    throw err;
  }

  return true;
}

/** Deactivates one token. No transaction needed - clearing to 0 never conflicts with the partial unique index. */
export function deactivateToken(id: number, serverId: number): boolean {
  const result = getWritableDb()
    .prepare(`UPDATE env SET is_active = 0 WHERE id = ? AND server_id = ?`)
    .run(id, serverId);
  return result.changes > 0;
}

/** Registers an env var name as a token for a server. Starts inactive. */
export function addToken(serverId: number, tokenName: string, type: string): boolean {
  const result = getWritableDb()
    .prepare(
      `INSERT INTO env (server_id, token_name, type, is_active) VALUES (?, ?, ?, 0)`,
    )
    .run(serverId, tokenName, type);
  return result.changes > 0;
}

/**
 * Root `.env` keys not yet registered as a token for this server, each
 * paired with the type its `__<TYPE>` suffix suggests, if any. `null` if the
 * server doesn't exist.
 */
export function listAvailableTokens(slug: string): EnvKeyEntry[] | null {
  const serverId = findServerBySlug(slug)?.id;
  if (!serverId) return null;

  const used = new Set(
    (
      getDb()
        .prepare(`SELECT token_name FROM env WHERE server_id = ?`)
        .all(serverId) as { token_name: string }[]
    ).map((row) => row.token_name),
  );

  return listEnvKeys().filter((entry) => !used.has(entry.key));
}
