// Dialect-detection DB singleton. MySQL in prod, SQLite for tests/local.
// Pattern mirrored from medbridge/server/db.ts.

export const dialect: "mysql" | "sqlite" =
  (process.env.DB_DIALECT as "mysql" | "sqlite" | undefined) ??
  (process.env.DATABASE_URL?.startsWith("mysql") ? "mysql" : "sqlite");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = any;

let _db: AnyDb | null = null;
let _schema: AnySchema | null = null;

export async function getSchema(): Promise<AnySchema> {
  if (_schema) return _schema;
  _schema =
    dialect === "sqlite"
      ? await import("./db/schema.sqlite.js")
      : await import("./db/schema.js");
  return _schema;
}

async function ensureSqliteTables(sqlite: AnyDb): Promise<void> {
  // Idempotent CREATE TABLE IF NOT EXISTS for the SQLite test backend.
  // Mirrors drizzle/schema.sqlite.ts exactly.
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tw_users (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS tw_moves (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    measurement_type TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tw_moves_name_idx ON tw_moves (name)`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS tw_workouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    updated_at INTEGER NOT NULL
  )`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tw_workouts_user_idx ON tw_workouts (user_id)`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS tw_log_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workout_id TEXT,
    move_id TEXT NOT NULL,
    move_name_snapshot TEXT NOT NULL,
    measurement_type TEXT NOT NULL,
    weight REAL,
    weight_unit TEXT,
    reps INTEGER,
    duration_seconds INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    weight_recorded_at INTEGER,
    reps_recorded_at INTEGER,
    intensity REAL,
    intensity_metric TEXT,
    interval_kind TEXT,
    interval_label TEXT,
    updated_at INTEGER NOT NULL
  )`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tw_entries_user_idx ON tw_log_entries (user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tw_entries_workout_idx ON tw_log_entries (workout_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tw_entries_updated_at_idx ON tw_log_entries (updated_at)`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS tw_sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    client_updated_at INTEGER NOT NULL,
    server_updated_at INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
}

export async function getDb(): Promise<AnyDb> {
  if (_db) return _db;

  if (dialect === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const dbPath = process.env.DATABASE_URL || "local.db";
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite);
    await ensureSqliteTables(sqlite);
    return _db;
  }

  // MySQL
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for MySQL dialect");
  }
  const { drizzle } = await import("drizzle-orm/mysql2");
  _db = drizzle(process.env.DATABASE_URL);

  // Auto-run migrations on first connection
  try {
    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    await migrate(_db, { migrationsFolder: "./drizzle/mysql-migrations" });
    console.log("[db] migrations applied");
  } catch (err) {
    console.warn("[db] migration warning:", (err as Error).message);
  }

  return _db;
}

/** Reset the singleton — for tests that need a fresh in-memory DB. */
export function resetDb(): void {
  _db = null;
  _schema = null;
}
