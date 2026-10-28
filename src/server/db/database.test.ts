import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspect } from "node:util";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { WEEKDAYS } from "@/domain/opening-hours";

import { lockPathFor } from "./folder-lock";
import { chooseDatabase, closeDatabase, createDatabase, type Database, isNextHelperProcess } from "./index";
import { garageSettings, openingHours, weekday } from "./schema";
import { seedGarage } from "./seed";
import { ownerGarage } from "./seed-data";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine:
// in task 14 the 10-second hook limit timed out under load (load average
// ~14) while the same tests took ~16 s alone. Only these database test files
// get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Each test database is PGlite in memory: a real Postgres inside this
// process, migrated and seeded exactly as `npm run dev` does it. Opening one
// takes about a second, so tests that only read share one.

const memory = { driver: "pglite", dataDir: null } as const;

/** The Postgres error behind a failed query: its code and the constraint it broke. */
async function violation(query: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  // Only a failed query counts; anything else is a bug in the test.
  if (!(error instanceof DrizzleQueryError)) throw error;
  const { code, constraint } = error.cause as { code?: string; constraint?: string };
  return { code, constraint };
}

/**
 * Runs raw SQL on a PGlite test database and returns the rows. (Database's
 * own execute() returns unknown: each driver shapes raw results differently.)
 */
async function rawRows<Row>(db: Database, query: string): Promise<Row[]> {
  if (!(db.$client instanceof PGlite)) throw new Error("expected a PGlite test database");
  return (await db.$client.query<Row>(query)).rows;
}

/** How many rows each table holds. */
async function rowCounts(db: Database) {
  return {
    garage: await db.$count(garageSettings),
    hours: await db.$count(openingHours),
  };
}

describe("the schema", () => {
  test("lists the weekdays exactly as the app does, Monday first", () => {
    expect(weekday.enumValues).toEqual([...WEEKDAYS]);
  });
});

describe("chooseDatabase (which database each way of running gets)", () => {
  const cwd = "/repo";
  const local = { appEnv: "local", databaseUrl: undefined } as const;

  test("npm run dev: PGlite in .pglite/, next to package.json", () => {
    expect(chooseDatabase(local, { nodeEnv: "development", nextPhase: undefined, cwd })).toEqual({
      driver: "pglite",
      dataDir: path.join(cwd, ".pglite"),
    });
  });

  test.each(["production", "test", undefined])("NODE_ENV %s: PGlite in memory", (nodeEnv) => {
    expect(chooseDatabase(local, { nodeEnv, nextPhase: undefined, cwd })).toEqual(memory);
  });

  test("next build --debug-prerender (NODE_ENV development during the build): PGlite in memory", () => {
    expect(chooseDatabase(local, { nodeEnv: "development", nextPhase: "phase-production-build", cwd })).toEqual(memory);
  });

  test.each(["development", "production"])("a DATABASE_URL wins, even under NODE_ENV %s", (nodeEnv) => {
    const url = "postgresql://gomechanic:fake-password@localhost:5432/gomechanic";
    expect(chooseDatabase({ appEnv: "production", databaseUrl: url }, { nodeEnv, nextPhase: undefined, cwd })).toEqual({
      driver: "postgres",
      url,
    });
  });
});

describe("a new local database", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createDatabase(memory);
  });
  afterAll(async () => {
    await closeDatabase(db);
  });

  test("holds exactly one garage: the owner's", async () => {
    const rows = await db.select().from(garageSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      phone: ownerGarage.phone,
      whatsapp: ownerGarage.whatsapp,
      addressText: ownerGarage.address.text,
      postalCode: ownerGarage.address.postalCode,
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  test("holds seven hours rows: Monday closed, 10:00 to 19:00 the rest", async () => {
    const rows = await db.select().from(openingHours).orderBy(openingHours.weekday);
    expect(rows).toEqual(
      WEEKDAYS.map((day) =>
        day === "monday"
          ? { weekday: day, opens: null, closes: null }
          : // Postgres gives a time back with seconds.
            { weekday: day, opens: "10:00:00", closes: "19:00:00" },
      ),
    );
  });

  test("runs in UTC, whatever the computer's time zone", async () => {
    expect(await rawRows(db, "show timezone")).toEqual([{ TimeZone: "UTC" }]);
  });

  test("seeding again adds nothing", async () => {
    await seedGarage(db);
    expect(await rowCounts(db)).toEqual({ garage: 1, hours: 7 });
  });

  test("refuses a second garage row", async () => {
    // id 2: the CHECK (id = 1) stops it.
    expect(await violation(db.insert(garageSettings).values({ ...seedRow(), id: 2 }))).toEqual({
      code: "23514", // check_violation
      constraint: "garage_settings_single_row",
    });
    // The default id (1) is taken: the primary key stops it.
    expect(await violation(db.insert(garageSettings).values(seedRow()))).toEqual({
      code: "23505", // unique_violation
      constraint: "garage_settings_pkey",
    });
  });

  test("refuses hours that close before they open, and a day with only one time", async () => {
    const tuesday = (values: { opens: string | null; closes: string | null }) =>
      db.update(openingHours).set(values).where(sql`${openingHours.weekday} = 'tuesday'`);
    const check = { code: "23514", constraint: "opening_hours_closed_or_opens_before_closes" };

    expect(await violation(tuesday({ opens: "19:00", closes: "10:00" }))).toEqual(check);
    expect(await violation(tuesday({ opens: "10:00", closes: null }))).toEqual(check);
    expect(await violation(tuesday({ opens: null, closes: "19:00" }))).toEqual(check);
  });
});

/** A garage_settings row with the owner's values. */
function seedRow() {
  return {
    phone: ownerGarage.phone,
    whatsapp: ownerGarage.whatsapp,
    addressText: ownerGarage.address.text,
    postalCode: ownerGarage.address.postalCode,
  };
}

describe("seeding", () => {
  test("never overwrites a garage that's already there", async () => {
    const db = await createDatabase(memory);
    try {
      await db.update(garageSettings).set({ phone: "+912012345678" });
      await seedGarage(db);

      const [row] = await db.select({ phone: garageSettings.phone }).from(garageSettings);
      expect(row.phone).toBe("+912012345678");
      expect(await rowCounts(db)).toEqual({ garage: 1, hours: 7 });
    } finally {
      await closeDatabase(db);
    }
  });

  test("puts in the garage and its hours together or not at all: a failed hours insert leaves no garage", async () => {
    const db = await createDatabase(memory);
    try {
      await db.delete(openingHours);
      await db.delete(garageSettings);
      // A leftover Monday row: the seed's own Monday row clashes with it, so
      // the hours insert fails after the garage row went in.
      await db.insert(openingHours).values({ weekday: "monday", opens: null, closes: null });

      expect(await violation(seedGarage(db))).toEqual({ code: "23505", constraint: "opening_hours_pkey" });
      // The transaction rolled back: still no garage row.
      expect(await rowCounts(db)).toEqual({ garage: 0, hours: 1 });
    } finally {
      await closeDatabase(db);
    }
  });

  test("checks the garage first: a landline as WhatsApp throws and inserts nothing", async () => {
    const db = await createDatabase(memory);
    try {
      // Start from an empty (but migrated) database.
      await db.delete(openingHours);
      await db.delete(garageSettings);

      const broken = { ...ownerGarage, whatsapp: "+912012345678" };
      await expect(seedGarage(db, broken)).rejects.toThrow(/seed garage is invalid.*whatsapp/);
      expect(await rowCounts(db)).toEqual({ garage: 0, hours: 0 });
    } finally {
      await closeDatabase(db);
    }
  });
});

describe("the time zone", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is UTC even on a computer set to India time", async () => {
    // Without the fix, PGlite guesses "Etc/GMT-5" here: +05:00, not +05:30.
    vi.stubEnv("TZ", "Asia/Kolkata");
    const db = await createDatabase(memory);
    try {
      const rows = await rawRows(db, "select current_setting('TimeZone') as zone, to_char(now(), 'TZH:TZM') as offset");
      expect(rows).toEqual([{ zone: "UTC", offset: "+00:00" }]);
    } finally {
      await closeDatabase(db);
    }
  });
});

describe("a local database in a folder (what npm run dev uses)", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gomechanic-pglite-"));
  });
  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(lockPathFor(dataDir), { force: true });
  });

  test("can't be opened twice at once: the second open fails, and nothing touches the folder", async () => {
    const first = await createDatabase({ driver: "pglite", dataDir });
    try {
      // This process holds the lock, so even a second open from here fails.
      // Another process (Next.js's use-cache probe) gets the same error.
      await expect(createDatabase({ driver: "pglite", dataDir })).rejects.toThrow(
        `The local database (${dataDir}) is already open by process ${process.pid}`,
      );
      expect(fs.readFileSync(lockPathFor(dataDir), "utf8").split("\n")[0]).toBe(String(process.pid));
    } finally {
      await closeDatabase(first);
    }
    // Closing released the lock.
    expect(fs.existsSync(lockPathFor(dataDir))).toBe(false);
  });

  test("takes over a lock left by a process that has stopped", async () => {
    // A process that starts and exits at once: its id is free afterwards.
    const exited = spawnSync(process.execPath, ["-e", ""]);
    expect(exited.status).toBe(0);
    fs.writeFileSync(lockPathFor(dataDir), `${exited.pid}\nleft-behind-token\n`);

    const db = await createDatabase({ driver: "pglite", dataDir });
    try {
      expect(fs.readFileSync(lockPathFor(dataDir), "utf8").split("\n")[0]).toBe(String(process.pid));
    } finally {
      await closeDatabase(db);
    }
    expect(fs.existsSync(lockPathFor(dataDir))).toBe(false);
  });

  test("keeps changes after it's closed and opened again, and migrates only once", async () => {
    const first = await createDatabase({ driver: "pglite", dataDir });
    try {
      await first.update(garageSettings).set({ phone: "+912012345678" });
    } finally {
      await closeDatabase(first);
    }

    const second = await createDatabase({ driver: "pglite", dataDir });
    try {
      const [row] = await second.select({ phone: garageSettings.phone }).from(garageSettings);
      expect(row.phone).toBe("+912012345678");
      expect(await rowCounts(second)).toEqual({ garage: 1, hours: 7 });

      // Drizzle's record of applied migrations: one row per migration file.
      const journal = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "src/server/db/migrations/meta/_journal.json"), "utf8"),
      ) as { entries: { when: number }[] };
      const applied = await rawRows<{ created_at: string }>(
        second,
        "select created_at from drizzle.__drizzle_migrations order by id",
      );
      expect(applied.map((migration) => Number(migration.created_at))).toEqual(
        journal.entries.map((entry) => entry.when),
      );
    } finally {
      await closeDatabase(second);
    }
  });
});

describe("a real Postgres (DATABASE_URL)", () => {
  test("gets a postgres.js client that doesn't connect until the first query", async () => {
    // Nothing listens on port 1: connecting would fail, so this passes only
    // because postgres.js waits for a query.
    const db = await createDatabase({ driver: "postgres", url: "postgres://nobody:fake@127.0.0.1:1/none" });
    expect(db.$client).not.toBeInstanceOf(PGlite);
    await closeDatabase(db);
  });

  test.each([
    ["an unencoded / in the password", "postgresql://u:fake/s3cret@db.example.com:5432/postgres"],
    ["a broken % escape in the password", "postgresql://u:fake%zzs3cret@db.example.com:5432/postgres"],
  ])("a URL postgres.js can't read (%s) fails without showing the password", async (_case, url) => {
    const error = await createDatabase({ driver: "postgres", url }).then(
      () => {
        throw new Error("expected createDatabase to fail");
      },
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("DATABASE_URL");
    // inspect() is what console.error prints, so this covers every property
    // a log would show: the message, the stack, a cause, Node's `input`.
    expect(inspect(error, { depth: 10 })).not.toContain("s3cret");
  });
});

describe("getDatabase (one database per process)", () => {
  const key = "appDatabase";
  const globalSlot = globalThis as Record<string, unknown>;

  afterEach(async () => {
    const opened = globalSlot[key] as Promise<Database> | undefined;
    delete globalSlot[key];
    if (opened) await closeDatabase(await opened);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("opens nothing when the module is imported", async () => {
    vi.resetModules();
    await import("./index");
    expect(globalSlot[key]).toBeUndefined();
  });

  test("gives two calls made at the same time the same database", async () => {
    // A local test run: no deployment settings, so PGlite in memory. NODE_ENV
    // is set too: Vitest keeps one the shell already has, and "development"
    // would open the repo's .pglite/.
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PHASE", "");
    vi.resetModules();
    const { getDatabase } = await import("./index");

    const [a, b] = await Promise.all([getDatabase(), getDatabase()]);
    expect(a).toBe(b);
    expect(a.$client).toBeInstanceOf(PGlite);
    expect(await getDatabase()).toBe(a);
  });

  test("in a Next.js helper process (the dev server's use-cache probe), never opens the local folder", async () => {
    // `npm run dev` settings, in a temporary project folder.
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "gomechanic-project-"));
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PHASE", "");
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(project);
    const entryScript = process.argv[1];
    process.argv[1] = "/repo/node_modules/next/dist/compiled/jest-worker/processChild.js";
    try {
      vi.resetModules();
      const { getDatabase } = await import("./index");

      // The probe's own time limit then makes it "inconclusive", and the real
      // request goes on. A database that opened, or an error, would end it.
      const outcome = await Promise.race([
        getDatabase().then(
          () => "opened",
          () => "failed",
        ),
        new Promise((resolve) => setTimeout(() => resolve("still waiting"), 500)),
      ]);
      expect(outcome).toBe("still waiting");
      expect(fs.existsSync(path.join(project, ".pglite"))).toBe(false);
      expect(fs.existsSync(path.join(project, ".pglite.lock"))).toBe(false);
    } finally {
      // Never settles, so afterEach mustn't wait for it.
      delete globalSlot[key];
      process.argv[1] = entryScript;
      cwd.mockRestore();
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});

describe("isNextHelperProcess (is this one of Next.js's jest-worker children?)", () => {
  test.each([
    ["the use-cache probe's worker", "/repo/node_modules/next/dist/compiled/jest-worker/processChild.js", true],
    ["the same on Windows", "C:\\repo\\node_modules\\next\\dist\\compiled\\jest-worker\\processChild.js", true],
    ["the dev server", "/repo/node_modules/next/dist/server/lib/start-server.js", false],
    ["Vitest", "/repo/node_modules/vitest/dist/workers/forks.js", false],
    ["no entry script", undefined, false],
  ])("%s", (_case, entryScript, expected) => {
    expect(isNextHelperProcess(entryScript)).toBe(expected);
  });
});
