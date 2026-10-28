// The one place that opens the database. Server code asks for it with
// `await getDatabase()`; only the data-access layer (src/server/dal/) does.
//
// Which database you get depends on how the app runs:
//
//   DATABASE_URL set (any mode)        a real Postgres, through postgres.js
//   `npm run dev`                      PGlite in .pglite/ (kept between restarts)
//   `npm run build`, `npm start`,      PGlite in memory, a fresh one per process,
//   `npm run test:e2e`, Vitest         with the owner's garage
//
// PGlite is Postgres compiled to WebAssembly, running inside Node: no
// account, no Docker. It has a single connection, and two processes opening
// the same folder corrupt it (nothing locks it). So:
// - `next build` renders pages in several worker processes: each gets its own
//   in-memory database, never the folder.
// - `npm run db:reset` and drizzle-kit commands that open .pglite/ only run
//   while `npm run dev` is stopped.
//
// A local PGlite database migrates and seeds itself the first time it's used
// in a process. A real Postgres is never migrated or seeded by the app (task 20).

import "server-only";

import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { type ServerEnv, serverEnv } from "@/server/env";

import * as schema from "./schema";
import { seedGarage } from "./seed";

/**
 * The database, whichever driver is underneath. Drizzle's PGlite and
 * postgres.js databases both extend PgDatabase, so code written against this
 * type works with either. `$client` is the driver's own client.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema> & { $client: PGlite | Sql };

export type DatabaseConfig =
  | { driver: "postgres"; url: string }
  /** dataDir: a folder that keeps the data, or null to keep it in memory. */
  | { driver: "pglite"; dataDir: string | null };

/**
 * Which database to open (the table at the top of this file).
 * `nodeEnv` is "development" under `next dev`, "production" for
 * `next build` and `next start`, and "test" in Vitest.
 */
export function chooseDatabase(env: ServerEnv, nodeEnv: string | undefined, cwd: string): DatabaseConfig {
  if (env.databaseUrl) return { driver: "postgres", url: env.databaseUrl };
  if (nodeEnv === "development") return { driver: "pglite", dataDir: path.join(cwd, ".pglite") };
  return { driver: "pglite", dataDir: null };
}

/**
 * Opens a database. A PGlite one is also set to UTC, migrated and seeded
 * before it's returned. A postgres.js one doesn't connect yet: postgres.js
 * connects on the first query.
 */
export async function createDatabase(config: DatabaseConfig): Promise<Database> {
  if (config.driver === "postgres") {
    // Task 20 tunes this for Supabase: `prepare: false` for its transaction
    // pooler, and a pool size that fits the build's worker processes.
    return drizzlePostgres({ client: postgres(config.url), schema });
  }

  const client = await PGlite.create({
    dataDir: config.dataDir ?? undefined,
    // PGlite's own start settings, plus UTC. Otherwise PGlite guesses a zone
    // from the computer's: "Etc/GMT-5" (+05:00, not India's +05:30) on the
    // owner's laptop. Supabase runs in UTC, so SQL date maths matches it.
    startParams: [...PGlite.defaultStartParams, "-c", "TimeZone=UTC"],
  });
  try {
    const db = drizzlePglite({ client, schema });
    // Applies the committed migrations that this database hasn't had yet.
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "server", "db", "migrations") });
    await seedGarage(db);
    return db;
  } catch (error) {
    // Let go of the folder before failing, then fail with the same error.
    await client.close();
    throw error;
  }
}

/** Closes the database's connection (tests; the app keeps it open). */
export async function closeDatabase(db: Database): Promise<void> {
  if (db.$client instanceof PGlite) await db.$client.close();
  else await db.$client.end();
}

// Kept on globalThis, not in a module variable: `next dev` re-runs changed
// modules on every edit (hot reload), and a second PGlite on .pglite/ in the
// same process would corrupt it. globalThis survives the reload.
const globalForDatabase = globalThis as typeof globalThis & {
  appDatabase?: Promise<Database>;
};

/**
 * The database for this process, opened on the first call. Every later call,
 * including ones made while it's still opening, gets the same one.
 *
 * Nothing happens when this file is imported: the database opens on the first
 * query. If opening fails, every later call fails with the same error until
 * the server restarts; retrying could open the folder a second time.
 */
export function getDatabase(): Promise<Database> {
  globalForDatabase.appDatabase ??= createDatabase(
    chooseDatabase(serverEnv(), process.env.NODE_ENV, process.cwd()),
  );
  return globalForDatabase.appDatabase;
}
