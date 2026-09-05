import { listGithubToolPermissions } from "@/lib/db";
import type { PermissionState, ToolEffect } from "@/lib/db";

export type { PermissionState, ToolEffect };

export type ToolDescriptor = {
  slug: string;
  server_name: "github";
  server_effect: ToolEffect;
  summary: string;
  /** The seeded default - what `state` resets back to. */
  default_state: PermissionState;
  /** The live decision, editable via `/api/github_mcp_update_permission`. */
  state: PermissionState;
  /** Set only for a tool whose declared server_effect is known to be wrong. */
  known_defects?: string;
};

/**
 * Every row in `github_mcp`, live via `lib/db.ts`. A function, not a
 * module-level constant - `state` changes on every write through the API,
 * and a constant would only ever reflect whatever it was when this module
 * was first loaded by the server process, not the current row.
 *
 * A tool that exists in code (`tools/github/src/toolbox/index.ts`'s
 * `TOOL_REGISTRATIONS`) but has no row yet - no migration added since it was
 * added - simply won't appear here. Catching that case needs the live tool
 * enumeration docs/07-plans/current.md describes, cross-referencing code
 * against this table; not built yet.
 */
export function getGithubTools(): ToolDescriptor[] {
  return listGithubToolPermissions().map((row) => ({
    slug: row.slug,
    server_name: row.server_name as "github",
    server_effect: row.server_effect,
    summary: row.summary ?? "",
    default_state: row.default_state,
    state: row.state,
    known_defects: row.known_defects ?? undefined,
  }));
}

export function findTool(server_name: string, slug: string): ToolDescriptor | undefined {
  if (server_name !== "github") return undefined;
  return getGithubTools().find((tool) => tool.slug === slug);
}
