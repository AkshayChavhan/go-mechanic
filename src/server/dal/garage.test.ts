import { eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Garage } from "@/domain/garage";
import { fixedClock } from "@/lib/clock";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { garageSettings, openingHours } from "@/server/db/schema";
import { seedGarage } from "@/server/db/seed";
import { ownerGarage } from "@/server/db/seed-data";

import { readGarage, saveGarage } from "./garage";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine:
// in task 14 the 10-second hook limit timed out under load (load average
// ~14) while the same tests took ~16 s alone. Only these database test files
// get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite (migrated and seeded, like
// the real one), and next/cache for spies: cacheTag, cacheLife and updateTag
// only work inside a Next.js render or Server Action. The "use cache" line
// does nothing outside Next.js, so every readGarage() call here really reads.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  // Back to the owner's garage, whatever the last test saved.
  await db.delete(openingHours);
  await db.delete(garageSettings);
  await seedGarage(db);
});

// 27 Oct 2026, 15:30 India time.
const savedAt = new Date("2026-10-27T10:00:00Z");

/** The owner's garage with a new phone, and Monday open 10:00 to 14:00. */
const edited: Garage = {
  ...ownerGarage,
  phone: "+912012345678",
  hours: { ...ownerGarage.hours, monday: { opens: "10:00", closes: "14:00" } },
};

/** The stored garage row, read straight from the database. */
async function storedRow() {
  const [row] = await db.select().from(garageSettings);
  return row;
}

describe("readGarage (the cached public read)", () => {
  test("returns the owner's garage from a seeded database", async () => {
    expect(await readGarage()).toEqual(ownerGarage);
  });

  test('is cached with the "garage" tag and the "max" lifetime', async () => {
    await readGarage();
    expect(cacheTag).toHaveBeenCalledWith("garage");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  test('reads a stored "10:00:00" as "10:00"', async () => {
    const [tuesday] = await db.select().from(openingHours).where(eq(openingHours.weekday, "tuesday"));
    expect(tuesday.opens).toBe("10:00:00");

    expect((await readGarage()).hours.tuesday).toEqual({ opens: "10:00", closes: "19:00" });
  });

  test("reads a missing weekday as closed", async () => {
    await db.delete(openingHours).where(eq(openingHours.weekday, "sunday"));
    const garage = await readGarage();
    expect(garage.hours.sunday).toBe("closed");
    expect(garage.hours.saturday).toEqual({ opens: "10:00", closes: "19:00" });
  });

  test("throws a clear error when the database has no garage", async () => {
    await db.delete(garageSettings);
    await expect(readGarage()).rejects.toThrow("The garage's details are missing");
  });
});

describe("saveGarage (checked, all at once, then the cache is refreshed)", () => {
  test("saves a valid garage: the next read has the new values", async () => {
    expect(await saveGarage(edited, fixedClock(savedAt))).toEqual({ ok: true });

    expect(await readGarage()).toEqual(edited);
    expect(await db.$count(openingHours)).toBe(7);
    expect((await storedRow()).updatedAt).toEqual(savedAt);
    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith("garage");
  });

  test("refuses a landline as WhatsApp: nothing is written and the cache isn't touched", async () => {
    const before = await storedRow();

    expect(await saveGarage({ ...edited, whatsapp: "+912012345678" }, fixedClock(savedAt))).toEqual({
      ok: false,
      problems: [{ field: "whatsapp" }],
    });
    expect(await storedRow()).toEqual(before);
    expect(await readGarage()).toEqual(ownerGarage);
    expect(updateTag).not.toHaveBeenCalled();
  });

  test("passes a database error on, and doesn't touch the cache", async () => {
    const closed = await createDatabase({ driver: "pglite", dataDir: null });
    await closeDatabase(closed);
    vi.mocked(getDatabase).mockResolvedValue(closed);

    await expect(saveGarage(edited, fixedClock(savedAt))).rejects.toThrow("PGlite is closed");
    expect(updateTag).not.toHaveBeenCalled();
  });

  test("refuses to save when the garage row is missing, and keeps the hours", async () => {
    await db.delete(garageSettings);

    await expect(saveGarage(edited, fixedClock(savedAt))).rejects.toThrow("garage_settings table has no row");
    // The transaction rolled back: Monday is still closed.
    const [monday] = await db.select().from(openingHours).where(eq(openingHours.weekday, "monday"));
    expect(monday).toEqual({ weekday: "monday", opens: null, closes: null });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
