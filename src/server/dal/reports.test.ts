import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingLine, BookingStatus } from "@/domain/bookings";
import type { JobStatus } from "@/domain/jobs";
import type { Role } from "@/domain/roles";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingItems, bookings, reviews, services, users } from "@/server/db/schema";

import { readBookingsReport, readRatingReport, readTopServicesReport, readWorkloadReport } from "./reports";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The report reads against a real (in-memory) database with the draft
// catalogue and services. getDatabase is swapped for it, next/cache for spies,
// and the session for a fake: the manager, unless a test says otherwise.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));

type FakeUser = { id: string; name: string; phoneNumber: string; role: Role };
const asha: FakeUser = { id: "asha", name: "Asha", phoneNumber: "+919876500001", role: "customer" };
const mona: FakeUser = { id: "mona", name: "Mona", phoneNumber: "+919876500003", role: "mechanic" };
const manager: FakeUser = { id: "manu", name: "Manu", phoneNumber: "+919876500004", role: "manager" };
const owner: FakeUser = { id: "omar", name: "Omar", phoneNumber: "+919876500005", role: "owner" };

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
  logIn(manager);
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(users);
  await db.update(services).set({ name: { en: "Brake service" } }).where(eq(services.id, "brakes"));
  await db.insert(users).values(
    [asha, mona, manager, owner].map(({ id, name, phoneNumber }) => ({
      id,
      name,
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
    })),
  );
});

// 1 to 7 November 2026, India days: 31 Oct 18:30Z up to 7 Nov 18:30Z.
const PERIOD = { from: "2026-11-01", to: "2026-11-07" };

const line = (serviceId: string, position = 0): BookingLine => ({
  serviceId,
  kind: "service",
  name: { en: `Old name of ${serviceId}` },
  priceStatus: "no-price",
  pricePaise: null,
  position,
});

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let codeCounter = 0;
function nextCode(): string {
  codeCounter += 1;
  return `AAAA${CODE_LETTERS[Math.floor(codeCounter / CODE_LETTERS.length) % CODE_LETTERS.length]}${CODE_LETTERS[codeCounter % CODE_LETTERS.length]}`;
}

/** Writes a booking straight into the table (the save's own rules are tested in bookings.test.ts). */
async function book({
  startsAt,
  status = "booked",
  jobStatus = null,
  assigned = null,
  lines = [line("brakes")],
}: {
  startsAt: string;
  status?: BookingStatus;
  jobStatus?: JobStatus | null;
  assigned?: string | null;
  lines?: BookingLine[];
}) {
  const [row] = await db
    .insert(bookings)
    .values({
      code: nextCode(),
      userId: "asha",
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB0042",
      startsAt: new Date(startsAt),
      isEstimate: true,
      totalPaise: null,
      requestToken: randomUUID(),
      status,
      jobStatus,
      assignedMechanicId: assigned,
    })
    .returning({ id: bookings.id });
  if (lines.length > 0) await db.insert(bookingItems).values(lines.map((item) => ({ bookingId: row!.id, ...item, serviceKind: item.kind })));
  return row!.id;
}

async function review(rating: number, createdAt: string, hidden = false) {
  const bookingId = await book({ startsAt: "2026-10-01T05:00:00Z", jobStatus: "completed", lines: [] });
  await db.insert(reviews).values({
    bookingId,
    userId: "asha",
    rating,
    shownName: "Asha",
    requestToken: randomUUID(),
    createdAt: new Date(createdAt),
    ...(hidden && { hiddenAt: new Date(createdAt), hiddenBy: "omar" }),
  });
}

const reads = [
  ["readBookingsReport", readBookingsReport],
  ["readTopServicesReport", readTopServicesReport],
  ["readRatingReport", readRatingReport],
  ["readWorkloadReport", readWorkloadReport],
] as const;

describe.each(reads)("%s: who may read", (_name, read) => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: refused before the database is opened", async (_label, user) => {
    logIn(user);
    await expect(read(PERIOD)).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a customer with a bad period is refused too: access comes before the input", async () => {
    logIn(asha);
    await expect(read({ from: "x", to: "y" })).rejects.toBeInstanceOf(AccessDeniedError);
  });

  test.each([
    { from: "2026-11-07", to: "2026-11-01" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2025-01-01", to: "2026-11-01" },
  ])("an unusable period (%j) answers invalid-period without a query", async (period) => {
    expect(await read(period)).toEqual({ ok: false, problem: "invalid-period" });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test.each([["the manager", manager], ["the owner", owner]])("%s may read", async (_label, user) => {
    logIn(user);
    expect(await read(PERIOD)).toMatchObject({ ok: true });
  });
});

describe("readBookingsReport", () => {
  test("only slots in the period, every status", async () => {
    await book({ startsAt: "2026-10-31T18:29:59Z" }); // 31 Oct in India: before
    await book({ startsAt: "2026-10-31T18:30:00Z" }); // 1 Nov in India: in
    await book({ startsAt: "2026-11-07T18:29:59Z", status: "cancelled" }); // 7 Nov: in
    await book({ startsAt: "2026-11-07T18:30:00Z" }); // 8 Nov: after
    const result = await readBookingsReport(PERIOD);
    expect(result.ok && result.rows.map((row) => [row.startsAt.toISOString(), row.status]).sort()).toEqual([
      ["2026-10-31T18:30:00.000Z", "booked"],
      ["2026-11-07T18:29:59.000Z", "cancelled"],
    ]);
  });
});

describe("readTopServicesReport", () => {
  test("counts bookings per service with its current name; cancelled and no-show left out", async () => {
    await book({ startsAt: "2026-11-02T05:00:00Z", lines: [line("brakes"), line("battery", 1)] });
    await book({ startsAt: "2026-11-03T05:00:00Z", status: "confirmed" });
    await book({ startsAt: "2026-11-03T06:00:00Z", status: "cancelled" });
    await book({ startsAt: "2026-11-03T07:00:00Z", status: "no-show" });
    await book({ startsAt: "2026-11-20T05:00:00Z" }); // after the period
    const result = await readTopServicesReport(PERIOD);
    const rows = result.ok ? [...result.rows].sort((a, b) => a.serviceId.localeCompare(b.serviceId)) : [];
    expect(rows).toEqual([
      expect.objectContaining({ serviceId: "battery", bookings: 1 }),
      { serviceId: "brakes", name: { en: "Brake service" }, bookings: 2 },
    ]);
  });
});

describe("readRatingReport", () => {
  test("published reviews written in the period, per rating", async () => {
    await review(5, "2026-11-02T05:00:00Z");
    await review(5, "2026-11-03T05:00:00Z");
    await review(3, "2026-11-04T05:00:00Z");
    await review(1, "2026-11-04T06:00:00Z", true); // hidden
    await review(2, "2026-10-20T05:00:00Z"); // before
    const result = await readRatingReport(PERIOD);
    expect(result.ok && [...result.rows].sort((a, b) => b.rating - a.rating)).toEqual([
      { rating: 5, count: 2 },
      { rating: 3, count: 1 },
    ]);
  });
});

describe("readWorkloadReport", () => {
  test("active bookings per assignee, completed jobs counted, unassigned in its own row", async () => {
    await book({ startsAt: "2026-11-02T05:00:00Z", assigned: "mona", jobStatus: "completed" });
    await book({ startsAt: "2026-11-02T06:00:00Z", assigned: "mona", jobStatus: "in-service" });
    await book({ startsAt: "2026-11-02T07:00:00Z", assigned: "mona", status: "cancelled" });
    await book({ startsAt: "2026-11-02T08:00:00Z", assigned: "mona", status: "no-show" });
    // Assigned to someone who is a customer today: still counted under their name.
    await book({ startsAt: "2026-11-03T05:00:00Z", assigned: "asha", status: "confirmed" });
    await book({ startsAt: "2026-11-03T06:00:00Z" });
    const result = await readWorkloadReport(PERIOD);
    const rows = result.ok ? [...result.rows].sort((a, b) => (a.mechanicId ?? "").localeCompare(b.mechanicId ?? "")) : [];
    expect(rows).toEqual([
      { mechanicId: null, name: null, bookings: 1, completed: 0 },
      { mechanicId: "asha", name: "Asha", bookings: 1, completed: 0 },
      { mechanicId: "mona", name: "Mona", bookings: 2, completed: 1 },
    ]);
  });
});
