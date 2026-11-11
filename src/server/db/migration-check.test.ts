import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "./index";
import { checkMigrations, committedMigrations, describeMigrationProblems, postgresCode } from "./migration-check";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine (CLAUDE.md, "Database").
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

describe("checkMigrations", () => {
  test("a freshly migrated database has every committed migration, unchanged", async () => {
    const report = await checkMigrations(db);
    expect(report.total).toBeGreaterThan(0);
    expect(report).toEqual({ missing: [], changed: [], applied: report.total, total: report.total });
    expect(describeMigrationProblems(report)).toBeNull();
  });

  test("a migration whose file changed after it was applied is named", async () => {
    const [first] = committedMigrations();
    const report = await checkMigrations(db, [{ ...first!, hash: "0".repeat(64) }]);
    expect(report.changed).toEqual([first!.tag]);
    expect(describeMigrationProblems(report)).toContain(`changed after they were applied: ${first!.tag}`);
  });

  test("an older migration that was never applied is named, even though newer ones were (the out-of-order case)", async () => {
    const committed = committedMigrations();
    const newest = committed.at(-1)!;
    const skipped = { tag: "0001_merged_late", when: committed[0]!.when + 1, hash: "a".repeat(64) };
    const report = await checkMigrations(db, [...committed.slice(0, -1), skipped, newest]);
    expect(report.missing).toEqual(["0001_merged_late"]);
    expect(describeMigrationProblems(report)).toContain("not applied: 0001_merged_late");
  });

  test("a database that was never migrated has every migration missing", async () => {
    await db.execute(sql`alter table drizzle.__drizzle_migrations rename to __drizzle_migrations_hidden`);
    try {
      const report = await checkMigrations(db);
      expect(report.applied).toBe(0);
      expect(report.missing).toEqual(committedMigrations().map((migration) => migration.tag));
    } finally {
      await db.execute(sql`alter table drizzle.__drizzle_migrations_hidden rename to __drizzle_migrations`);
    }
  });
});

describe("postgresCode", () => {
  test("finds the code on the error or on a wrapped cause", () => {
    expect(postgresCode({ code: "42P01" })).toBe("42P01");
    expect(postgresCode(new Error("wrapped", { cause: { code: "23505" } }))).toBe("23505");
    expect(postgresCode(new Error("no code"))).toBeUndefined();
  });
});
