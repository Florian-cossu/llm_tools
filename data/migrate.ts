import { Database, constants } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "harness.db");

const NOW = new Date();
const TIMESTAMP = NOW.toISOString();

const db = new Database(DB_PATH, { create: true, strict: true });
db.run("PRAGMA journal_mode = WAL;");

db.run(
  `CREATE TABLE IF NOT EXISTS meta (
        filename TEXT NOT NULL PRIMARY KEY,
        applied_at TEXT NOT NULL
    )`,
);

const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

let migrations: { filename: string; instruction: string }[] = [];

function discoverMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];

  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

const migrationFiles = discoverMigrations();
const appliedMigrationsQuery = db.query<{ filename: string }, []>(
  "SELECT filename FROM meta",
);
const appliedMigrations = appliedMigrationsQuery.all();
appliedMigrationsQuery.finalize();

let applied = appliedMigrations.map((row) => row.filename);

for (let file of migrationFiles) {
  if (applied.length > 0 && applied.includes(file)) continue;

  let migrationInstruction = "";

  try {
    migrationInstruction = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  } catch (error) {
    console.error(`Unable to read file ${file}: ${error}`);
  }

  if (typeof migrationInstruction == "string" && migrationInstruction != "") {
    migrations.push({ filename: file, instruction: migrationInstruction });
  }
}

const migrationTransaction = db.transaction(() => {
  const insert = db.prepare(
    `INSERT INTO meta (filename, applied_at) VALUES (?, ?)`,
  );

  for (let migration of migrations) {
    db.run(migration.instruction);
    insert.run(migration.filename, TIMESTAMP);
  }
});

migrationTransaction();

// Disable persistent WAL (needed on macOS)
db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
// Checkpoint and truncate the WAL file
db.run("PRAGMA wal_checkpoint(TRUNCATE);");
db.close();
// Only mydb.sqlite remains — no -wal or -shm files
