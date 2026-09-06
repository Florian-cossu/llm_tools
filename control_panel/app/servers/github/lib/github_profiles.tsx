import { findServerBySlug } from "@/lib/servers";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const GITHUB_SERVER_SLUG = "github";

const DB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../data/harness.db",
);

let db: DatabaseSync | undefined;

export type GithubProfile = {
    id: number;
    server_id: number;
    profile_name: string;
    repository_owner: string;
    repository_name: string;
    is_active: 1|0;
} | undefined

type GithubProfileRow = NonNullable<GithubProfile>;

/**
 * Maps into a plain object literal - `node:sqlite`'s result rows aren't
 * plain objects, and React rejects them when a Server Component passes them
 * as props into a Client Component (see `lib/servers.ts`).
 */
function toGithubProfile(row: GithubProfileRow): GithubProfile {
  return {
    id: row.id,
    server_id: row.server_id,
    profile_name: row.profile_name,
    repository_owner: row.repository_owner,
    repository_name: row.repository_name,
    is_active: row.is_active,
  };
}

function getDb(): DatabaseSync {
  if (!db) db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

let writableDb: DatabaseSync | undefined;

/** Opens `harness.db` read-write on first use. Only for code that mutates rows. */
function getWritableDb(): DatabaseSync {
  if (!writableDb) writableDb = new DatabaseSync(DB_PATH);
  return writableDb;
}

export function listGithubProfiles(): GithubProfile[] {
    const rows = getDb()
    .prepare("SELECT * FROM github_profiles")
    .all() as GithubProfileRow[];

    return rows.map(toGithubProfile);
}

/** Returns `false` if the github server row doesn't exist, `true` once inserted. */
export function addGithubProfile(profileName: string, owner: string, repo: string): boolean {
    const server = findServerBySlug(GITHUB_SERVER_SLUG);
    if (!server) return false;

    const result = getWritableDb()
    .prepare(`INSERT INTO github_profiles (server_id, profile_name, repository_owner, repository_name, is_active) VALUES (?, ?, ?, ?, ?)`)
    .run(server.id, profileName, owner, repo, 0);

    return result.changes > 0;
}

/**
 * Sets one profile's `is_active` flag. At most one `github_profiles` row is
 * ever active: turning a profile on clears every other row for the same
 * server in the same statement, so there's no window where two rows are
 * active at once. Returns `false` if the github server row doesn't exist or
 * `id` doesn't match a row - an UPDATE with no matching `id` would otherwise
 * still report rows changed, since the `active` branch's WHERE clause
 * matches every row for the server, not just `id`.
 */
export function setGithubProfileActive(id: number, active: boolean): boolean {
    const server = findServerBySlug(GITHUB_SERVER_SLUG);
    if (!server) return false;

    const exists = getDb()
      .prepare(`SELECT 1 FROM github_profiles WHERE id = ? AND server_id = ?`)
      .get(id, server.id);
    if (!exists) return false;

    getWritableDb()
      .prepare(
        active
          ? `UPDATE github_profiles SET is_active = (id = ?) WHERE server_id = ?`
          : `UPDATE github_profiles SET is_active = 0 WHERE id = ? AND server_id = ?`,
      )
      .run(id, server.id);

    return true;
}