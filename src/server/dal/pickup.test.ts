import { cacheLife, cacheTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { pickupAreas } from "@/server/db/schema";

import { PICKUP_AREAS_TAG, readPickupAreas } from "./pickup";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite, and next/cache for spies:
// cacheTag and cacheLife only work inside a Next.js render. "use cache" does
// nothing outside Next.js, so every call here really reads.
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
  await db.delete(pickupAreas);
});

describe("readPickupAreas", () => {
  test("an empty table (every build today) is an empty list", async () => {
    expect(await readPickupAreas()).toEqual([]);
  });

  test("the listed areas, ordered by PIN code; a paused one is left out", async () => {
    await db.insert(pickupAreas).values([
      { postalCode: "412105", feePaise: 20_000 },
      { postalCode: "410501", feePaise: 30_000, listed: false },
      { postalCode: "412101", feePaise: 0 },
    ]);
    expect(await readPickupAreas()).toEqual([
      { postalCode: "412101", feePaise: 0 },
      { postalCode: "412105", feePaise: 20_000 },
    ]);
  });

  test("is cached with its tag and the max lifetime", async () => {
    await readPickupAreas();
    expect(cacheTag).toHaveBeenCalledWith(PICKUP_AREAS_TAG);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});
