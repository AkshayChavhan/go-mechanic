import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingLine, BookingStatus } from "@/domain/bookings";
import type { JobStatus } from "@/domain/jobs";
import { can } from "@/domain/permissions";
import type { Role } from "@/domain/roles";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookingItems, bookings, estimates, users, vehicleModels } from "@/server/db/schema";

import { listBookingsOn } from "./staff-bookings";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The staff bookings read against a real (in-memory) database with the draft
// catalogue and services. getDatabase is swapped for it, next/cache for spies
// (only Next.js provides them), and the session for a fake: the manager,
// unless a test says otherwise. `can` stays real unless a test stubs it.
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
  // clearAllMocks keeps a stubbed implementation, so put the real rule back:
  // a test that stubs can() must not change the next test's permissions.
  const permissions = await vi.importActual<typeof import("@/domain/permissions")>("@/domain/permissions");
  vi.mocked(can).mockImplementation(permissions.can);
  vi.mocked(getDatabase).mockResolvedValue(db);
  logIn(manager);
  await db.delete(bookings);
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

const DAY = "2026-11-24";

const brakes: BookingLine = {
  serviceId: "brakes",
  kind: "service",
  name: { en: "Brakes" },
  priceStatus: "price",
  pricePaise: 150_000,
  position: 0,
};
const battery: BookingLine = {
  serviceId: "battery",
  kind: "service",
  name: { en: "Battery" },
  priceStatus: "no-price",
  pricePaise: null,
  position: 1,
};

type BookingRow = {
  userId?: string;
  startsAt: string;
  code?: string;
  modelId?: string;
  pickup?: { address: string; postalCode: string; feePaise: number } | null;
  lines?: BookingLine[];
  status?: BookingStatus;
  jobStatus?: JobStatus | null;
  assigned?: string | null;
};

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let codeCounter = 0;
/** A fresh valid code per booking: "AAAAA" plus a counter letter. */
function nextCode(): string {
  codeCounter += 1;
  return `AAAA${CODE_LETTERS[Math.floor(codeCounter / CODE_LETTERS.length) % CODE_LETTERS.length]}${CODE_LETTERS[codeCounter % CODE_LETTERS.length]}`;
}

/** Writes a booking straight into the table (the save's own rules are tested in bookings.test.ts). */
async function book({
  userId = "asha",
  startsAt,
  code = nextCode(),
  modelId = "car-honda-city",
  pickup = null,
  lines = [brakes],
  status = "booked",
  jobStatus = null,
  assigned = null,
}: BookingRow) {
  const [row] = await db
    .insert(bookings)
    .values({
      code,
      userId,
      vehicleKind: "car",
      modelId,
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB0042",
      startsAt: new Date(startsAt),
      isEstimate: true,
      totalPaise: 150_000,
      requestToken: randomUUID(),
      pickupAddress: pickup?.address ?? null,
      pickupPostalCode: pickup?.postalCode ?? null,
      pickupFeePaise: pickup?.feePaise ?? null,
      status,
      jobStatus,
      assignedMechanicId: assigned,
    })
    .returning({ id: bookings.id });
  if (lines.length > 0) await db.insert(bookingItems).values(lines.map((line) => ({ bookingId: row!.id, ...line, serviceKind: line.kind })));
  return row!.id;
}

const pickup = { address: "12 MG Road, Pune", postalCode: "411001", feePaise: 0 };

describe("listBookingsOn", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mechanic],
  ])("%s: refused before the database is opened", async (_label, user) => {
    logIn(user);
    await expect(listBookingsOn(DAY)).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a customer with an unreadable date is refused too: access is checked before the input", async () => {
    logIn(asha);
    await expect(listBookingsOn("tomorrow")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  test.each(["2026-02-30", "tomorrow", "", "2026-11-24T00:00"])("an unreadable date (%j) answers invalid-date without a query", async (date) => {
    expect(await listBookingsOn(date)).toEqual({ ok: false, problem: "invalid-date" });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the day is India's: 00:00 and 23:30 on it count, the day before's 23:30 and the next 00:00 don't", async () => {
    // India is UTC+5:30, so 24 Nov in India runs from 23 Nov 18:30 UTC.
    const first = await book({ startsAt: "2026-11-23T18:30:00Z" }); // 24 Nov 00:00 IST
    const last = await book({ startsAt: "2026-11-24T18:00:00Z" }); // 24 Nov 23:30 IST
    await book({ startsAt: "2026-11-23T18:00:00Z" }); // 23 Nov 23:30 IST
    await book({ startsAt: "2026-11-24T18:30:00Z" }); // 25 Nov 00:00 IST

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    expect(result.bookings.map((row) => row.id)).toEqual([first, last]);
  });

  test("rows come in time order, each with its lines in position order and the booking's own copies", async () => {
    const late = await book({ userId: "ravi", startsAt: "2026-11-24T06:30:00Z", lines: [battery, brakes] });
    const early = await book({ startsAt: "2026-11-24T04:30:00Z", code: "K7Q4MX", pickup });

    logIn(owner);
    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    expect(result.bookings.map((row) => row.id)).toEqual([early, late]);
    expect(result.bookings[0]).toEqual({
      id: early,
      code: "K7Q4MX",
      startsAt: new Date("2026-11-24T04:30:00Z"),
      status: "booked",
      vehicle: {
        kind: "car",
        makeName: { en: "Honda" },
        modelName: { en: "City" },
        fuel: "petrol",
        registrationNumber: "MH12AB0042",
      },
      lines: [brakes],
      totalPaise: 150_000,
      pickup: { included: true, address: "12 MG Road, Pune", postalCode: "411001", feePaise: 0 },
      customerName: "Asha",
      phoneNumber: asha.phoneNumber,
      jobStatus: null,
      mechanic: null,
      cancelReason: null,
      estimate: null,
    });
    // Inserted battery (position 1) first: the order comes from `position`.
    expect(result.bookings[1]!.lines).toEqual([brakes, battery]);
    expect(result.bookings[1]).toMatchObject({
      customerName: "Ravi",
      phoneNumber: ravi.phoneNumber,
      pickup: { included: false, address: null, postalCode: null, feePaise: null },
    });
  });

  test("a model the garage later hid still shows its make and model", async () => {
    await book({ startsAt: "2026-11-24T04:30:00Z" });
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    expect(result.bookings[0]!.vehicle).toMatchObject({ makeName: { en: "Honda" }, modelName: { en: "City" } });
  });

  test("without customers.contact, the phone and the pickup address are hidden but pickup still shows as included", async () => {
    await book({ startsAt: "2026-11-24T04:30:00Z", pickup });
    vi.mocked(can).mockImplementation((_, permission) => permission === "bookings.manage");

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    expect(result.bookings[0]).toMatchObject({
      customerName: "Asha",
      phoneNumber: null,
      pickup: { included: true, address: null, postalCode: null, feePaise: 0 },
    });
  });

  test("two bookings in the same slot both show, each with its own lines", async () => {
    const first = await book({ startsAt: "2026-11-24T04:30:00Z", lines: [brakes] });
    const second = await book({ userId: "ravi", startsAt: "2026-11-24T04:30:00Z", lines: [battery] });

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    expect(new Set(result.bookings.map((row) => row.id))).toEqual(new Set([first, second]));
    const linesOf = (id: string) => result.bookings.find((row) => row.id === id)!.lines.map((line) => line.serviceId);
    expect(linesOf(first)).toEqual([brakes.serviceId]);
    expect(linesOf(second)).toEqual([battery.serviceId]);
  });

  test("each row has its job step, its mechanic by name, and a cancelled one its reason", async () => {
    await db.update(users).set({ name: "Mona" }).where(eq(users.id, "mona"));
    const assigned = await book({ startsAt: "2026-11-24T04:30:00Z", status: "confirmed", jobStatus: "inspection", assigned: "mona" });
    const cancelled = await book({ userId: "ravi", startsAt: "2026-11-24T05:30:00Z", status: "cancelled", assigned: "mona" });
    const noShow = await book({ startsAt: "2026-11-24T06:30:00Z", status: "no-show" });
    const event = { kind: "status-change" as const, actorUserId: "manu", requestToken: randomUUID() };
    await db.insert(bookingEvents).values([
      { ...event, bookingId: cancelled, newStatus: "confirmed", requestToken: randomUUID(), createdAt: new Date("2026-11-20T04:00:00Z") },
      { ...event, bookingId: cancelled, newStatus: "cancelled", reason: "Customer called", createdAt: new Date("2026-11-20T05:00:00Z") },
      { ...event, bookingId: noShow, newStatus: "no-show", requestToken: randomUUID() },
    ]);

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    const row = (id: string) => result.bookings.find((booking) => booking.id === id)!;
    expect(row(assigned)).toMatchObject({ status: "confirmed", jobStatus: "inspection", mechanic: { id: "mona", name: "Mona" }, cancelReason: null });
    expect(row(cancelled)).toMatchObject({ status: "cancelled", jobStatus: null, mechanic: { id: "mona", name: "Mona" }, cancelReason: "Customer called" });
    expect(row(noShow)).toMatchObject({ status: "no-show", mechanic: null, cancelReason: null });
  });

  test("each row has its newest estimate version, draft or sent, or null without one", async () => {
    const withDraft = await book({ startsAt: "2026-11-24T04:30:00Z", jobStatus: "awaiting-approval" });
    const withSent = await book({ startsAt: "2026-11-24T05:30:00Z", jobStatus: "awaiting-approval" });
    const without = await book({ startsAt: "2026-11-24T06:30:00Z" });
    const sent = { sentAt: new Date("2026-11-24T05:00:00Z"), sentBy: "manu", sendToken: randomUUID() };
    await db.insert(estimates).values([
      // Version 1 sent, version 2 a draft (the Change estimate case).
      { bookingId: withDraft, version: 1, createdBy: "manu", createToken: randomUUID(), ...sent },
      { bookingId: withDraft, version: 2, createdBy: "manu", createToken: randomUUID() },
      { bookingId: withSent, version: 1, createdBy: "manu", createToken: randomUUID(), ...sent, sendToken: randomUUID() },
    ]);

    const result = await listBookingsOn(DAY);
    if (!result.ok) throw new Error("expected bookings");
    const row = (id: string) => result.bookings.find((booking) => booking.id === id)!;
    expect(row(withDraft).estimate).toEqual({ version: 2, state: "draft" });
    expect(row(withSent).estimate).toEqual({ version: 1, state: "sent" });
    expect(row(without).estimate).toBeNull();
  });

  test("a day with no bookings gives an empty list", async () => {
    await book({ startsAt: "2026-11-25T04:30:00Z" });
    expect(await listBookingsOn(DAY)).toEqual({ ok: true, bookings: [] });
  });
});
