import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { EstimateRequestInput } from "@/domain/estimate-requests";
import { can } from "@/domain/permissions";
import type { Role } from "@/domain/roles";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { customerVehicles, estimateRequests, photoSets, photos, users, vehicleModels } from "@/server/db/schema";

import { addMyVehicle, removeMyVehicle } from "./customer-vehicles";
import { createMyEstimateRequest, listEstimateRequests, listMyEstimateRequests } from "./estimate-requests";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The estimate request save and reads against a real (in-memory) database
// with the draft catalogue. getDatabase is swapped for it, next/cache for
// spies (the cached catalogue read calls cacheTag and cacheLife, which only
// work inside Next.js), and the session for a fake: Asha, unless a test says
// otherwise. `can` stays real unless a test stubs it.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/domain/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/permissions")>();
  return { ...actual, can: vi.fn(actual.can) };
});

type FakeUser = { id: string; phoneNumber: string; role: Role };
const asha: FakeUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const ravi: FakeUser = { id: "ravi", phoneNumber: "+919876500002", role: "customer" };
const mechanic: FakeUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const manager: FakeUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };
const owner: FakeUser = { id: "omar", phoneNumber: "+919876500005", role: "owner" };

function logIn(user: FakeUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

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
  logIn(asha);
  await db.delete(estimateRequests);
  await db.delete(photoSets);
  await db.delete(customerVehicles);
  await db.delete(users);
  await db.update(vehicleModels).set({ listed: true });
  await db.insert(users).values(
    [asha, ravi, mechanic, manager, owner].map(({ id, phoneNumber }) => ({
      id,
      name: id === "asha" ? "Asha" : id === "ravi" ? "Ravi" : "Staff",
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
    })),
  );
});

const clock = fixedClock(new Date("2026-11-19T10:00:00Z"));
const HOUR_MS = 60 * 60 * 1000;

/** A valid send: a petrol Honda City from the picker, no photos. */
function input(changes: Partial<EstimateRequestInput> = {}): EstimateRequestInput {
  return {
    vehicle: { modelId: "car-honda-city", fuel: "petrol" },
    description: "Brakes squeal when I stop",
    photoSetId: "",
    requestToken: randomUUID(),
    ...changes,
  };
}

/** Saves a vehicle for whoever is logged in and returns its id. */
async function saveVehicle(registration = "MH 12 AB 1234"): Promise<string> {
  const saved = await addMyVehicle({ modelId: "car-honda-city", fuel: "petrol", registration, pucExpiresOn: "", insuranceExpiresOn: "" });
  if (saved.status !== "saved") throw new Error("could not save the vehicle");
  return saved.id;
}

/** A photo set for `userId` with `stored` stored photos and one pending one. */
async function photoSet(userId: string, { stored = 1, closed = false } = {}): Promise<string> {
  const [set] = await db
    .insert(photoSets)
    .values({ userId, closedAt: closed ? new Date() : null })
    .returning({ id: photoSets.id });
  const rows = Array.from({ length: stored + 1 }, (_, index) => {
    const id = randomUUID();
    return index < stored
      ? { id, setId: set!.id, storageKey: `sets/${set!.id}/${id}.jpg`, status: "stored" as const, bytes: 1000, storedAt: new Date() }
      : { id, setId: set!.id, storageKey: `sets/${set!.id}/${id}.jpg` };
  });
  await db.insert(photos).values(rows);
  return set!.id;
}

describe("createMyEstimateRequest", () => {
  test("logged out: refused before the database is opened", async () => {
    logIn(null);
    await expect(createMyEstimateRequest(input(), clock)).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a picker vehicle is copied without a registration number", async () => {
    const result = await createMyEstimateRequest(input({ description: "  Squeal\r\nwhen cold  " }), clock);
    expect(result.status).toBe("sent");
    const [row] = await db.select().from(estimateRequests);
    expect(row).toMatchObject({
      userId: "asha",
      vehicleId: null,
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      registrationNumber: null,
      description: "Squeal\nwhen cold",
      photoSetId: null,
      createdAt: clock.now(),
    });
  });

  test("a saved vehicle is copied with its registration number", async () => {
    const vehicleId = await saveVehicle();
    expect((await createMyEstimateRequest(input({ vehicle: { savedVehicleId: vehicleId } }), clock)).status).toBe("sent");
    const [row] = await db.select().from(estimateRequests);
    expect(row).toMatchObject({ vehicleId, modelId: "car-honda-city", registrationNumber: "MH12AB1234" });
  });

  test("another customer's saved vehicle, or a malformed id, is not found", async () => {
    logIn(ravi);
    const ravisVehicle = await saveVehicle();
    logIn(asha);
    expect(await createMyEstimateRequest(input({ vehicle: { savedVehicleId: ravisVehicle } }), clock)).toEqual({ status: "not-found" });
    expect(await createMyEstimateRequest(input({ vehicle: { savedVehicleId: "abc" } }), clock)).toEqual({ status: "not-found" });
    expect(await db.select().from(estimateRequests)).toEqual([]);
  });

  test("a model that isn't listed, or a fuel it doesn't take, is refused", async () => {
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect(await createMyEstimateRequest(input(), clock)).toEqual({
      status: "problems",
      problems: [{ field: "vehicle", problem: "vehicle-unknown-model" }],
    });
    await db.update(vehicleModels).set({ listed: true });
    expect(await createMyEstimateRequest(input({ vehicle: { modelId: "car-honda-city", fuel: "electric" } }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "vehicle", problem: "vehicle-fuel-not-offered" }],
    });
  });

  test("input problems come back without touching the database", async () => {
    expect(await createMyEstimateRequest(input({ description: "short" }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "description", problem: "description-too-short" }],
    });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the same token twice makes one request and answers duplicate", async () => {
    const same = input();
    const first = await createMyEstimateRequest(same, clock);
    const second = await createMyEstimateRequest(same, clock);
    expect(first.status).toBe("sent");
    expect(second).toEqual({ status: "duplicate", id: first.status === "sent" ? first.id : "" });
    expect(await db.select().from(estimateRequests)).toHaveLength(1);
  });

  test("a retry after the saved vehicle was removed is still duplicate", async () => {
    const vehicleId = await saveVehicle();
    const same = input({ vehicle: { savedVehicleId: vehicleId } });
    expect((await createMyEstimateRequest(same, clock)).status).toBe("sent");
    await removeMyVehicle(vehicleId);
    expect((await createMyEstimateRequest(same, clock)).status).toBe("duplicate");
  });

  test("a retry after the model was hidden is still duplicate", async () => {
    const same = input();
    expect((await createMyEstimateRequest(same, clock)).status).toBe("sent");
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect((await createMyEstimateRequest(same, clock)).status).toBe("duplicate");
  });

  test("the customer's own open photo set is kept with the request", async () => {
    const setId = await photoSet("asha");
    expect((await createMyEstimateRequest(input({ photoSetId: setId }), clock)).status).toBe("sent");
    const [row] = await db.select().from(estimateRequests);
    expect(row?.photoSetId).toBe(setId);
  });

  test.each([
    ["another customer's set", async () => photoSet("ravi")],
    ["a closed set", async () => photoSet("asha", { closed: true })],
    ["a set that doesn't exist", async () => randomUUID()],
  ])("%s is refused as photos-not-found", async (_, makeSet) => {
    const setId = await makeSet();
    expect(await createMyEstimateRequest(input({ photoSetId: setId }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "photos", problem: "photos-not-found" }],
    });
  });

  test("a set already used by a request is refused for a new one; a retry with the same token is duplicate", async () => {
    const setId = await photoSet("asha");
    const same = input({ photoSetId: setId });
    expect((await createMyEstimateRequest(same, clock)).status).toBe("sent");
    expect((await createMyEstimateRequest(same, clock)).status).toBe("duplicate");
    expect(await createMyEstimateRequest(input({ photoSetId: setId }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "photos", problem: "photos-not-found" }],
    });
  });

  test("the 4th request in 24 hours is refused; one 25 hours old doesn't count", async () => {
    await createMyEstimateRequest(input(), fixedClock(new Date(clock.now().getTime() - 25 * HOUR_MS)));
    for (let sent = 0; sent < 3; sent++) {
      expect((await createMyEstimateRequest(input(), clock)).status).toBe("sent");
    }
    expect(await createMyEstimateRequest(input(), clock)).toEqual({ status: "too-many-requests", limit: 3 });
    // Another customer has their own limit.
    logIn(ravi);
    expect((await createMyEstimateRequest(input(), clock)).status).toBe("sent");
  });
});

describe("listMyEstimateRequests", () => {
  test("logged out: refused before the database is opened", async () => {
    logIn(null);
    await expect(listMyEstimateRequests()).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("only the caller's requests, newest first, with names and stored photos counted", async () => {
    const setId = await photoSet("asha", { stored: 2 });
    await createMyEstimateRequest(input({ description: "The older request" }), fixedClock(new Date("2026-11-18T10:00:00Z")));
    await createMyEstimateRequest(input({ description: "The newer request", photoSetId: setId }), clock);
    logIn(ravi);
    await createMyEstimateRequest(input({ description: "Ravi's own request" }), clock);
    logIn(asha);

    const rows = await listMyEstimateRequests();
    expect(rows.map((row) => row.description)).toEqual(["The newer request", "The older request"]);
    expect(rows[0]).toMatchObject({
      kind: "car",
      makeName: { en: "Honda" },
      modelName: { en: "City" },
      fuel: "petrol",
      registrationNumber: null,
      photoSetId: setId,
      photoCount: 2,
    });
    expect(rows[1]?.photoCount).toBe(0);
  });
});

describe("listEstimateRequests (staff)", () => {
  beforeEach(async () => {
    await createMyEstimateRequest(input({ description: "Asha's request here" }), clock);
    logIn(ravi);
    await createMyEstimateRequest(input({ description: "Ravi's request here" }), fixedClock(new Date(clock.now().getTime() + HOUR_MS)));
  });

  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mechanic],
  ])("%s is refused before the database is opened", async (_, user) => {
    logIn(user);
    vi.mocked(getDatabase).mockClear();
    await expect(listEstimateRequests()).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test.each([
    ["a manager", manager],
    ["the owner", owner],
  ])("%s sees every request, newest first, with the customer's name and phone", async (_, user) => {
    logIn(user);
    const rows = await listEstimateRequests();
    expect(rows.map((row) => [row.description, row.customerName, row.phoneNumber])).toEqual([
      ["Ravi's request here", "Ravi", ravi.phoneNumber],
      ["Asha's request here", "Asha", asha.phoneNumber],
    ]);
  });

  test("the limit applies", async () => {
    logIn(owner);
    expect(await listEstimateRequests({ limit: 1 })).toHaveLength(1);
  });

  test("staff who may manage estimates but not contact customers get no phone number", async () => {
    logIn(manager);
    vi.mocked(can).mockImplementation((_, permission) => permission === "estimates.manage");
    const rows = await listEstimateRequests();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.phoneNumber === null)).toBe(true);
  });
});
