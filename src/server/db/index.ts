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
// the same folder corrupt it. PGlite itself doesn't stop them, so:
// - A lock file (.pglite.lock, folder-lock.ts) lets one process at a time
//   open the folder; any other process gets a clear error instead.
// - `next dev` can start helper processes: its use-cache probe re-runs a
//   slow cached read in a jest-worker child. Those never open the folder
//   (openForThisProcess, below).
// - `next build` renders pages in several worker processes: each gets its own
//   in-memory database, never the folder, even under `--debug-prerender`,
//   which builds with NODE_ENV=development (chooseDatabase).
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
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import postgres, { type Sql } from "postgres";

import { type ServerEnv, serverEnv } from "@/server/env";

import { type FolderLock, lockFolder } from "./folder-lock";
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

/** How this process runs: what chooseDatabase looks at besides the settings. */
export type RunContext = {
  /** NODE_ENV: "development" under `next dev`, "production" for `next build` and `next start`, "test" in Vitest. */
  nodeEnv: string | undefined;
  /** NEXT_PHASE: Next.js sets "phase-production-build" before `next build` starts its workers. */
  nextPhase: string | undefined;
  /** The project folder (process.cwd()), where .pglite/ lives. */
  cwd: string;
};

/** Which database to open (the table at the top of this file). */
export function chooseDatabase(env: Pick<ServerEnv, "databaseUrl">, run: RunContext): DatabaseConfig {
  if (env.databaseUrl) return { driver: "postgres", url: env.databaseUrl };
  // A build always gets memory: `next build --debug-prerender` sets
  // NODE_ENV=development for its workers, and several of them would open the
  // folder at once.
  if (run.nodeEnv === "development" && run.nextPhase !== PHASE_PRODUCTION_BUILD) {
    return { driver: "pglite", dataDir: path.join(run.cwd, ".pglite") };
  }
  return { driver: "pglite", dataDir: null };
}

/**
 * A postgres.js client for `url`, without the password ever reaching a log.
 *
 * postgres.js reads the URL right away with `new URL(url)`. A password with
 * an unencoded "/", "?" or "#" breaks that, and Node's TypeError keeps the
 * whole URL, password included, in its `input` property; Next.js logs the
 * error object when a build or a cached read fails. So the two errors a
 * broken URL causes (TypeError from `new URL`, URIError from decoding a bad
 * "%" escape) become a new error with a fixed message and no `cause`.
 * Anything else is passed on unchanged.
 */
function postgresClient(url: string): Sql {
  try {
    return postgres(url);
  } catch (error) {
    if (error instanceof TypeError || error instanceof URIError) {
      throw new Error(
        "DATABASE_URL is not a valid Postgres URL. Percent-encode special characters in the password " +
          '("/" as %2F, "?" as %3F, "#" as %23, "@" as %40, "%" as %25).',
      );
    }
    throw error;
  }
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
    return drizzlePostgres({ client: postgresClient(config.url), schema });
  }

  // A folder is opened by one process at a time: the lock throws if another
  // one has it (folder-lock.ts). A database in memory needs no lock.
  const lock = config.dataDir === null ? null : lockFolder(config.dataDir);

  let client: PGlite;
  try {
    client = await PGlite.create({
      dataDir: config.dataDir ?? undefined,
      // PGlite's own start settings, plus UTC. Otherwise PGlite guesses a zone
      // from the computer's: "Etc/GMT-5" (+05:00, not India's +05:30) on the
      // owner's laptop. Supabase runs in UTC, so SQL date maths matches it.
      startParams: [...PGlite.defaultStartParams, "-c", "TimeZone=UTC"],
    });
  } catch (error) {
    lock?.release();
    throw error;
  }

  try {
    const db = drizzlePglite({ client, schema });
    // Applies the committed migrations that this database hasn't had yet.
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "server", "db", "migrations") });
    await seedGarage(db);
    if (lock) folderLocks.set(db, lock);
    return db;
  } catch (error) {
    // Let go of the folder and its lock before failing, then fail with the
    // same error.
    await client.close();
    lock?.release();
    throw error;
  }
}

// Each folder database's lock, so closeDatabase can release it.
const folderLocks = new WeakMap<Database, FolderLock>();

/** Closes the database's connection and releases its folder's lock (tests; the app keeps it open). */
export async function closeDatabase(db: Database): Promise<void> {
  if (db.$client instanceof PGlite) {
    await db.$client.close();
    folderLocks.get(db)?.release();
    folderLocks.delete(db);
  } else {
    await db.$client.end();
  }
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
  globalForDatabase.appDatabase ??= openForThisProcess(
    chooseDatabase(serverEnv(), { nodeEnv: process.env.NODE_ENV, nextPhase: process.env.NEXT_PHASE, cwd: process.cwd() }),
  );
  return globalForDatabase.appDatabase;
}

/**
 * Whether this process is one of Next.js's helper processes: a jest-worker
 * child, started from next/dist/compiled/jest-worker/processChild.js. (Its
 * environment has no marker: Next.js passes its own `env` to the fork.)
 */
export function isNextHelperProcess(entryScript: string | undefined = process.argv[1]): boolean {
  return /[\\/]jest-worker[\\/]processChild\.js$/.test(entryScript ?? "");
}

/**
 * Opens `config`, except in a Next.js helper process, which never opens the
 * local folder: its database never arrives (the promise never settles).
 *
 * Why: when a cached read is slow (over 10 s), `next dev` re-runs it in a
 * helper process (its use-cache probe) to check for a deadlock. If the read
 * fails there, even with the lock's "already open" error, Next.js counts the
 * run as "completed" (use-cache-wrapper.js keeps the error for later) and
 * fails the real request with a deadlock error: a 500 in task 14's check. A
 * read that never finishes runs into the probe's own time limit instead,
 * which counts as "inconclusive", and the real request carries on. Next.js
 * expects hung probes: they wait in the helper until its next reload.
 * If Next.js ever starts the probe some other way, the lock still keeps the
 * folder safe; only that slow request would fail.
 */
function openForThisProcess(config: DatabaseConfig): Promise<Database> {
  if (config.driver === "pglite" && config.dataDir !== null && isNextHelperProcess()) {
    return new Promise<Database>(() => {});
  }
  return createDatabase(config);
}
