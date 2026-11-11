import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "@/server/db/index";
import { slotRules } from "@/server/db/schema";
import { ownerSeedData } from "@/server/db/seed";

import { describeFailure } from "./run";
import { StagingSettingsError } from "./settings";
import { checkStaging, migrateStaging, seedStaging, type StagingDeps } from "./tasks";

// These run the scripts' steps against a local PGlite database standing in
// for staging: no network database is ever touched. Starting and migrating
// PGlite takes a few seconds, much longer on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  await db.update(slotRules).set({ capacity: ownerSeedData.rules.capacity });
});

/** Deps around the shared test database; the database stays open between tests. */
function deps(overrides: Partial<StagingDeps> = {}): StagingDeps & { opened: number } {
  const result = {
    opened: 0,
    guard: () => [],
    open: async () => {
      result.opened += 1;
      return db;
    },
    applyMigrations: async () => {},
    close: async () => {},
    ...overrides,
  };
  return result;
}

describe("staging:migrate", () => {
  test("on an up-to-date database, applies nothing and says staging has every migration", async () => {
    const result = await migrateStaging(deps());
    expect(result.ok).toBe(true);
    expect(result.lines[0]).toMatch(/^Applied 0; staging has all \d+ migrations\.$/);
  });

  test("a checkout that doesn't match main is refused before the database is opened", async () => {
    const run = deps({ guard: () => ["These differ from origin/main: x."] });
    expect(await migrateStaging(run)).toEqual({ ok: false, lines: ["These differ from origin/main: x."] });
    expect(run.opened).toBe(0);
  });

  test("when a migration is still missing afterwards, it fails and names it", async () => {
    const [newest] = await db.execute<{ id: number }>(sql`select id from drizzle.__drizzle_migrations order by created_at desc limit 1`).then(
      (result) => (result as unknown as { rows: { id: number }[] }).rows,
    );
    await db.execute(sql`delete from drizzle.__drizzle_migrations where id = ${newest!.id}`);
    try {
      const result = await migrateStaging(deps());
      expect(result.ok).toBe(false);
      expect(result.lines[0]).toContain("not applied");
    } finally {
      // Puts the row back the way drizzle's migrator would.
      const { committedMigrations } = await import("@/server/db/migration-check");
      const last = committedMigrations().at(-1)!;
      await db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${last.hash}, ${last.when})`);
    }
  });
});

describe("staging:seed", () => {
  test("on a seeded database, adds nothing and reports no differences", async () => {
    const result = await seedStaging(deps());
    expect(result).toEqual({ ok: true, lines: ["Seeded; every seed row matches main's seed data."] });
  });

  test("lists a stored row that differs, and points to a data migration", async () => {
    await db.update(slotRules).set({ capacity: ownerSeedData.rules.capacity + 1 });
    const result = await seedStaging(deps());
    expect(result.ok).toBe(true);
    expect(result.lines.join("\n")).toContain("slot rules: capacity is");
    expect(result.lines.at(-1)).toContain("data migration");
  });

  test("a checkout that doesn't match main is refused before the database is opened", async () => {
    const run = deps({ guard: () => ["no"] });
    expect((await seedStaging(run)).ok).toBe(false);
    expect(run.opened).toBe(0);
  });
});

describe("staging:check (the Vercel build's first step)", () => {
  const open = async () => db;
  const close = async () => {};

  test("outside staging, does nothing", async () => {
    const opened = vi.fn(open);
    expect((await checkStaging({ APP_ENV: "local" }, opened, close)).ok).toBe(true);
    expect(opened).not.toHaveBeenCalled();
  });

  test("on staging without DATABASE_URL, fails and names the setting", async () => {
    expect(await checkStaging({ APP_ENV: "staging" }, open, close)).toEqual({
      ok: false,
      lines: ["DATABASE_URL is not set for this staging build."],
    });
  });

  test("passes when every migration and seed row matches main", async () => {
    const result = await checkStaging({ APP_ENV: "staging", DATABASE_URL: "postgres://unused" }, open, close);
    expect(result.ok).toBe(true);
  });

  test("fails, naming the row, when a seed row differs from main's seed data", async () => {
    await db.update(slotRules).set({ capacity: ownerSeedData.rules.capacity + 1 });
    const result = await checkStaging({ APP_ENV: "staging", DATABASE_URL: "postgres://unused" }, open, close);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toContain("slot rules: capacity is");
  });

  test("an unencoded password in DATABASE_URL fails with the fixed message, and the password appears nowhere", async () => {
    let lines: string[] = [];
    try {
      await checkStaging({ APP_ENV: "staging", DATABASE_URL: "postgresql://u:fake/s3cret@db.example.com:6543/postgres" });
    } catch (error) {
      lines = [(error as Error).message, ...describeFailure(error)];
    }
    expect(lines[0]).toContain("DATABASE_URL is not a valid Postgres URL");
    expect(lines.join("\n")).not.toContain("s3cret");
  });
});

describe("describeFailure", () => {
  test("prints our own setting errors as they are, and anything else by name and code only", () => {
    expect(describeFailure(new StagingSettingsError("STAGING_DATABASE_URL is not set."))).toEqual(["STAGING_DATABASE_URL is not set."]);
    const leaky = Object.assign(new Error("password authentication failed for user postgres.s3cret"), { code: "28P01" });
    const lines = describeFailure(leaky);
    expect(lines[0]).toBe("Failed with Error (Postgres code 28P01).");
    expect(lines.join("\n")).not.toContain("s3cret");
  });
});
