import { findServerBySlug } from "@/lib/servers";
import { listPermissions } from "@/lib/db";
import type { PermissionState, ToolEffect } from "@/lib/db";

export type { PermissionState, ToolEffect };

export const GITHUB_SERVER_SLUG = "github";

export type ToolDescriptor = {
  slug: string;
  server_id: number;
  server_effect: ToolEffect;
  summary: string;
  /** The seeded default - what `state` resets back to. */
  default_state: PermissionState;
  /** The live decision, editable via `/api/github_mcp_update_permission`. */
  state: PermissionState;
};

/**
 * Every `permissions` row scoped to the github server, live via lib/db.ts. A
 * function, not a module-level constant - `state` changes on every write
 * through the API, and a constant would only ever reflect whatever it was
 * when this module was first loaded by the server process, not the current
 * row.
 *
 * Looks up the github server's id from `servers` first, then filters
 * `permissions` by it - the same shape any other per-server lib under
 * `lib/<server>/` would follow.
 */
export function getGithubTools(): ToolDescriptor[] {
  const server = findServerBySlug(GITHUB_SERVER_SLUG);
  if (!server) return [];

  return listPermissions(server.id).map((row) => ({
    slug: row.slug,
    server_id: row.server_id,
    server_effect: row.tool_effect,
    summary: row.description ?? "",
    default_state: row.default_state,
    state: row.state,
  }));
}

export function findGithubTool(slug: string): ToolDescriptor | undefined {
  return getGithubTools().find((tool) => tool.slug === slug);
}
