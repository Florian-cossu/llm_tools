import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const DB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/harness.db",
);

let db: DatabaseSync | undefined;

type ServerIconSource = "lucide" | "local";

export type ServerDescriptor = {
  id: number;
  slug: string;
  server_name: string;
  description: string;
  icon_name?: string;
  icon_source?: ServerIconSource;
}

type ServerRow = {
  id: number;
  slug: string;
  server_name: string;
  description: string;
  icon_name: string | null;
  icon_source: ServerIconSource | null;
};

function toServerDescriptor(row: ServerRow): ServerDescriptor {
  return {
    id: row.id,
    slug: row.slug,
    server_name: row.server_name,
    description: row.description,
    icon_name: row.icon_name ?? undefined,
    icon_source: row.icon_source ?? undefined,
  };
}

function getDb(): DatabaseSync {
  if (!db) db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

/**
 * Every MCP server row in `servers`, for nav only - each server has its own
 * manually authored page under `app/servers/<slug>/`, not a shared template,
 * so a custom layout is just a different page.tsx rather than a branch here.
 *
 * Server-only (uses `node:sqlite`) - call this from a Server Component and
 * pass the result down as props. Importing it from a "use client" file
 * bundles `node:sqlite` for the browser, which has no such module.
 *
 * Mapped into plain object literals - `node:sqlite`'s result rows aren't
 * plain objects, and React rejects them when a Server Component passes them
 * as props into a Client Component.
 */
export function listServers(): ServerDescriptor[] {
  const rows = getDb()
    .prepare("SELECT * FROM servers")
    .all() as ServerRow[];

  return rows.map(toServerDescriptor);
}

/** One server row by slug, or `null` if it doesn't exist. */
export function findServerBySlug(slug: string): ServerDescriptor | null {
  const row = getDb()
    .prepare("SELECT * FROM servers WHERE slug = ?")
    .get(slug) as ServerRow | undefined;

  return row ? toServerDescriptor(row) : null;
}
