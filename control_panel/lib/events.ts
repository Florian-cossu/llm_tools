import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Node-native mirror of `data/access.ts`'s `events` reads - see
 * `lib/db.ts` for why this can't just import that file directly.
 * Keep the SELECT in sync with it if the schema changes.
 */

const DB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/harness.db",
);

export type EventStatus = "success" | "error";

/**
 * One `events` row flattened with its `servers`/`permissions` names -
 * the table only stores `server_id`/`tool_id`, and the events page has
 * nothing else to display a human-readable server or tool with.
 */
export type EventLogRow = {
  id: number;
  server_slug: string;
  server_name: string;
  /** `null` when `tool_id` didn't resolve to a `permissions` row (or is unset). */
  tool_slug: string | null;
  session_id: string | null;
  status: EventStatus;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

let db: DatabaseSync | undefined;

/** Opens `harness.db` read-only on first use. Run `bun run migrate` first. */
function getDb(): DatabaseSync {
  if (!db) db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

const SELECT_EVENTS = `
  SELECT
    e.id            AS id,
    s.slug          AS server_slug,
    s.server_name   AS server_name,
    p.slug          AS tool_slug,
    e.session_id    AS session_id,
    e.status        AS status,
    e.error_message AS error_message,
    e.duration_ms   AS duration_ms,
    e.created_at    AS created_at
  FROM events e
  JOIN servers s ON s.id = e.server_id
  LEFT JOIN permissions p ON p.id = e.tool_id
`;

/** `from`/`to` are `YYYY-MM-DD` values; both ends are inclusive UTC calendar days. */
export type EventDateRange = { from?: string; to?: string };

/**
 * Builds the `WHERE` clause + bound params for `range`, shared by every query
 * below - the column is `TEXT` in `datetime('now')`'s zero-padded UTC format,
 * so a plain string comparison is already chronological order.
 */
function dateRangeWhere(range: EventDateRange): { clause: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];

  if (range.from) {
    clauses.push("e.created_at >= ?");
    params.push(`${range.from} 00:00:00`);
  }
  if (range.to) {
    clauses.push("e.created_at <= ?");
    params.push(`${range.to} 23:59:59`);
  }

  return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

/**
 * Every row in `events`, newest first, joined out to a displayable shape.
 * `range` pushes the date-range filter down to SQL against the indexed
 * `created_at` column, rather than fetching the whole table and filtering it
 * in the browser.
 *
 * Mapped into plain object literals - `node:sqlite`'s result rows aren't
 * plain objects, and React rejects them when a Server Component passes them
 * as props into a Client Component (see `lib/servers.ts`).
 */
export function listEvents(range: EventDateRange = {}): EventLogRow[] {
  const { clause, params } = dateRangeWhere(range);

  const rows = getDb()
    .prepare(`${SELECT_EVENTS} ${clause} ORDER BY e.created_at DESC, e.id DESC`)
    .all(...params) as EventLogRow[];

  return rows.map((row) => ({
    id: row.id,
    server_slug: row.server_slug,
    server_name: row.server_name,
    tool_slug: row.tool_slug,
    session_id: row.session_id,
    status: row.status,
    error_message: row.error_message,
    duration_ms: row.duration_ms,
    created_at: row.created_at,
  }));
}

export type OverviewStats = {
  total: number;
  successCount: number;
  /** `null` when no event in range recorded a duration. */
  avgDurationMs: number | null;
};

/** Headline counts for the stats dashboard - total events, successes, average duration. */
export function getOverviewStats(range: EventDateRange = {}): OverviewStats {
  const { clause, params } = dateRangeWhere(range);

  const row = getDb()
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END) AS success_count,
        ROUND(AVG(e.duration_ms)) AS avg_duration_ms
      FROM events e
      ${clause}
      `,
    )
    .get(...params) as { total: number; success_count: number; avg_duration_ms: number | null };

  return {
    total: row.total,
    successCount: row.success_count,
    avgDurationMs: row.avg_duration_ms,
  };
}

export type ToolCount = { tool_slug: string; count: number };

/** Event count per tool, busiest first. Events with no resolved tool group under `"unknown"`. */
export function getHitsByTool(range: EventDateRange = {}): ToolCount[] {
  const { clause, params } = dateRangeWhere(range);

  const rows = getDb()
    .prepare(
      `
      SELECT COALESCE(p.slug, 'unknown') AS tool_slug, COUNT(*) AS count
      FROM events e
      LEFT JOIN permissions p ON p.id = e.tool_id
      ${clause}
      GROUP BY tool_slug
      ORDER BY count DESC
      `,
    )
    .all(...params) as ToolCount[];

  return rows.map((row) => ({ tool_slug: row.tool_slug, count: row.count }));
}

export type ServerCount = { server_name: string; count: number };

/** Event count per server, busiest first. */
export function getHitsByServer(range: EventDateRange = {}): ServerCount[] {
  const { clause, params } = dateRangeWhere(range);

  const rows = getDb()
    .prepare(
      `
      SELECT s.server_name AS server_name, COUNT(*) AS count
      FROM events e
      JOIN servers s ON s.id = e.server_id
      ${clause}
      GROUP BY s.server_name
      ORDER BY count DESC
      `,
    )
    .all(...params) as ServerCount[];

  return rows.map((row) => ({ server_name: row.server_name, count: row.count }));
}

export type DailyVolume = { day: string; count: number };

/** Event count per UTC calendar day, oldest first. */
export function getDailyVolume(range: EventDateRange = {}): DailyVolume[] {
  const { clause, params } = dateRangeWhere(range);

  const rows = getDb()
    .prepare(
      `
      SELECT date(e.created_at) AS day, COUNT(*) AS count
      FROM events e
      ${clause}
      GROUP BY day
      ORDER BY day ASC
      `,
    )
    .all(...params) as DailyVolume[];

  return rows.map((row) => ({ day: row.day, count: row.count }));
}

export type ToolLatency = { tool_slug: string; avg_duration_ms: number };

/**
 * Average `duration_ms` per tool, slowest first. Only events with a recorded
 * duration count - `AVG` would otherwise silently skip `NULL`s anyway, but
 * the explicit filter keeps the WHERE clause honest about what's excluded.
 */
export function getLatencyByTool(range: EventDateRange = {}): ToolLatency[] {
  const { clause, params } = dateRangeWhere(range);
  const durationFilter = clause ? `${clause} AND e.duration_ms IS NOT NULL` : "WHERE e.duration_ms IS NOT NULL";

  const rows = getDb()
    .prepare(
      `
      SELECT COALESCE(p.slug, 'unknown') AS tool_slug, ROUND(AVG(e.duration_ms)) AS avg_duration_ms
      FROM events e
      LEFT JOIN permissions p ON p.id = e.tool_id
      ${durationFilter}
      GROUP BY tool_slug
      ORDER BY avg_duration_ms DESC
      `,
    )
    .all(...params) as ToolLatency[];

  return rows.map((row) => ({ tool_slug: row.tool_slug, avg_duration_ms: row.avg_duration_ms }));
}
