// What `npm run staging:migrate`, `staging:seed` and `staging:check` do
// (task 20; document/operations/staging.md). The command files next to this
// one only call these; tests call them with a local PGlite database.

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDatabase, createDatabase, type Database, postgresClient, postgresDatabase } from "@/server/db/index";
import { checkMigrations, describeMigrationProblems, MIGRATIONS_FOLDER } from "@/server/db/migration-check";
import { compareWithSeed, seedAll } from "@/server/db/seed";

import { originMainProblems } from "./guards";
import type { ScriptResult } from "./run";
import { type Environment, readStagingDatabaseUrl, STAGING_URL_VARIABLE } from "./settings";

/** Where to look up what the steps need; tests replace each part. */
export type StagingDeps = {
  /** Why this checkout may not write to staging ([] when it may). */
  guard: () => string[];
  /** Opens the staging database. */
  open: () => Promise<Database>;
  /** Applies the committed migrations. */
  applyMigrations: (db: Database) => Promise<void>;
  /** Closes what `open` opened. */
  close: (db: Database) => Promise<void>;
};

/** Opens staging through the session pooler: one connection, TLS, no notices printed. */
export async function openStagingDatabase(): Promise<Database> {
  const url = readStagingDatabaseUrl();
  return postgresDatabase(postgresClient(url, { max: 1, ssl: "require", onnotice: () => {} }, STAGING_URL_VARIABLE));
}

export const stagingDeps: StagingDeps = {
  guard: () => originMainProblems(),
  open: openStagingDatabase,
  applyMigrations: async (db) => {
    // The scripts only ever pass a postgres.js database here.
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
  },
  close: closeDatabase,
};

/** Applies main's migrations to staging, then checks that every one is there, unchanged. */
export async function migrateStaging(deps: StagingDeps = stagingDeps): Promise<ScriptResult> {
  const refused = deps.guard();
  if (refused.length > 0) return { ok: false, lines: refused };

  const db = await deps.open();
  try {
    const before = await checkMigrations(db);
    await deps.applyMigrations(db);
    const after = await checkMigrations(db);
    const problem = describeMigrationProblems(after);
    if (problem) return { ok: false, lines: [problem, 'See document/operations/staging.md, "When something goes wrong".'] };
    return { ok: true, lines: [`Applied ${after.applied - before.applied}; staging has all ${after.total} migrations.`] };
  } finally {
    await deps.close(db);
  }
}

/** Adds the seed rows staging is missing, then lists the stored rows that differ from the seed data. */
export async function seedStaging(deps: StagingDeps = stagingDeps): Promise<ScriptResult> {
  const refused = deps.guard();
  if (refused.length > 0) return { ok: false, lines: refused };

  const db = await deps.open();
  try {
    await seedAll(db);
    const differences = await compareWithSeed(db);
    if (differences.length === 0) return { ok: true, lines: ["Seeded; every seed row matches main's seed data."] };
    return {
      ok: true,
      lines: [
        "Seeded the missing rows. These rows differ from main's seed data, and seeding never changes them:",
        ...differences.map((difference) => `  ${difference}`),
        'To correct them, write a data migration (document/operations/staging.md, "After each merge").',
      ],
    };
  } finally {
    await deps.close(db);
  }
}

/**
 * The check the Vercel build runs before `next build` (vercel.json). Read-only.
 * Outside staging it does nothing. On staging it fails when a migration is
 * missing or changed, or a seed row is missing or differs from main's.
 */
export async function checkStaging(
  environment: Environment = process.env,
  open: (url: string) => Promise<Database> = (url) => createDatabase({ driver: "postgres", url }),
  close: (db: Database) => Promise<void> = closeDatabase,
): Promise<ScriptResult> {
  if (environment.APP_ENV !== "staging") return { ok: true, lines: ["APP_ENV isn't staging: nothing to check."] };
  const url = environment.DATABASE_URL;
  if (!url) return { ok: false, lines: ["DATABASE_URL is not set for this staging build."] };

  const db = await open(url);
  try {
    const problems: string[] = [];
    const migrationProblem = describeMigrationProblems(await checkMigrations(db));
    if (migrationProblem) problems.push(migrationProblem);
    const differences = await compareWithSeed(db);
    if (differences.length > 0) {
      problems.push("The database's seed rows don't match main's seed data:", ...differences.map((difference) => `  ${difference}`));
    }
    if (problems.length === 0) return { ok: true, lines: ["Staging's database matches main: every migration and seed row."] };
    return {
      ok: false,
      lines: [...problems, 'Fix it with staging:migrate or staging:seed from main (document/operations/staging.md, "After each merge").'],
    };
  } finally {
    await close(db);
  }
}
