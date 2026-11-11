// Does a database have every committed migration, exactly as committed?
//
// drizzle's migrator records each migration it applies in
// drizzle.__drizzle_migrations: the SHA-256 of its .sql file and the "when"
// of its journal entry. It only applies journal entries newer than the newest
// row there, and never compares hashes. So a migration merged out of order (a
// branch that generated it earlier) is skipped forever, and an edited one goes
// unnoticed (document/solutions/workflow-issues/
// parallel-branches-same-migration-number-regenerate-not-rename.md).
// This check finds both. The staging scripts run it after migrating and before
// every staging build (task 20).

import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";

import type { Database } from "./index";

/** drizzle's own bookkeeping table. Not in schema.ts: drizzle-kit would try to create it. */
const drizzleMigrations = pgSchema("drizzle").table("__drizzle_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "src", "server", "db", "migrations");

/** One committed migration: its file name (without .sql), its journal time and the hash drizzle records. */
export type CommittedMigration = { tag: string; when: number; hash: string };

/** The committed migrations, in journal order, hashed the way drizzle-orm's readMigrationFiles hashes them. */
export function committedMigrations(folder: string = MIGRATIONS_FOLDER): CommittedMigration[] {
  const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  return journal.entries.map(({ tag, when }) => ({
    tag,
    when,
    hash: createHash("sha256")
      .update(fs.readFileSync(path.join(folder, `${tag}.sql`)).toString())
      .digest("hex"),
  }));
}

export type MigrationReport = {
  /** Committed migrations the database has no row for. */
  missing: string[];
  /** Committed migrations whose recorded hash differs: the file changed after it was applied. */
  changed: string[];
  /** How many committed migrations the database has, unchanged. */
  applied: number;
  /** How many migrations are committed. */
  total: number;
};

/** Compares the database's applied migrations with the committed ones. A database never migrated has every one missing. */
export async function checkMigrations(db: Database, committed: CommittedMigration[] = committedMigrations()): Promise<MigrationReport> {
  const rows = await readAppliedRows(db);
  const byWhen = new Map(rows.map((row) => [row.createdAt, row.hash]));
  const report: MigrationReport = { missing: [], changed: [], applied: 0, total: committed.length };
  for (const migration of committed) {
    const hash = byWhen.get(migration.when);
    if (hash === undefined) report.missing.push(migration.tag);
    else if (hash !== migration.hash) report.changed.push(migration.tag);
    else report.applied += 1;
  }
  return report;
}

/** The applied rows, or none when the bookkeeping table doesn't exist yet (Postgres code 42P01). */
async function readAppliedRows(db: Database): Promise<{ hash: string; createdAt: number | null }[]> {
  try {
    return await db.select({ hash: drizzleMigrations.hash, createdAt: drizzleMigrations.createdAt }).from(drizzleMigrations);
  } catch (error) {
    if (postgresCode(error) === "42P01") return [];
    throw error;
  }
}

/** The Postgres error code of `error` or of its cause (drizzle wraps driver errors). */
export function postgresCode(error: unknown): string | undefined {
  for (let current: unknown = error; current instanceof Object; current = (current as { cause?: unknown }).cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/** One plain sentence for a report that isn't clean, or null when every migration is applied unchanged. */
export function describeMigrationProblems(report: MigrationReport): string | null {
  const parts: string[] = [];
  if (report.missing.length > 0) parts.push(`not applied: ${report.missing.join(", ")}`);
  if (report.changed.length > 0) parts.push(`changed after they were applied: ${report.changed.join(", ")}`);
  return parts.length === 0 ? null : `The database's migrations don't match the committed ones (${parts.join("; ")}).`;
}
