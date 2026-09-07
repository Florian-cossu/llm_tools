import { findServerBySlug, getDb } from "@llm-tools/data";
import { GithubProfile } from "../models/github_profiles.js";

const GITHUB_SERVER_SLUG = "github";

const GITHUB_PROFILE_ROWS = `id, server_id, profile_name, repository_owner, repository_name, is_active`;

/**
 * The one active `github_profiles` row for this server, or `null` if none
 * is active. Table name and columns are hardcoded, never interpolated - a
 * `?` placeholder only ever binds a value, never an identifier.
 */
export function getActiveGithubProfile(): GithubProfile | null {
  const serverId = findServerBySlug(GITHUB_SERVER_SLUG)?.id;

  if (!serverId) return null;

  return getDb()
    .query<
      GithubProfile,
      [number]
    >(`SELECT ${GITHUB_PROFILE_ROWS} FROM github_profiles WHERE server_id = ? AND is_active = 1`)
    .get(serverId) ?? null;
}
