import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { type BookingStatus, PLACE_HOLDING_STATUSES } from "@/domain/bookings";
import type { JobStatus } from "@/domain/jobs";
import type { Role } from "@/domain/roles";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookingItems, bookings, slotCounters, users } from "@/server/db/schema";

import { jobsOf } from "./job-access";
import { assignMechanic, changeBookingStatus } from "./staff-booking-changes";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
// The owner's number, fixed here so a test can put a stored mechanic on it.
const OWNER_NUMBER = "+919876500099";
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, serverEnv: () => ({ ...actual.parseServerEnv({}), ownerPhoneNumber: "+919876500099" }) };
});

type TestUser = { id: string; phoneNumber: string; role: Role };
const asha: TestUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const mona: TestUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const mike: TestUser = { id: "mike", phoneNumber: "+919876500006", role: "mechanic" };
const manu: TestUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };
const omar: TestUser = { id: "omar", phoneNumber: "+919876500005", role: "owner" };
// Stored as a mechanic, but on the owner's number: effectiveRole makes them the owner.
const ownerAsMechanic: TestUser = { id: "otto", phoneNumber: OWNER_NUMBER, role: "mechanic" };

function logIn(user: TestUser | null) {
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
  await db.delete(bookingEvents);
  await db.delete(bookings);
  await db.delete(slotCounters);
  await db.delete(users);
  await db.insert(users).values(
    [asha, mona, mike, manu, omar, ownerAsMechanic].map(({ id, phoneNumber, role }) => ({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
      role,
    })),
  );
  logIn(manu);
});

// Every test leaves each slot's counter equal to the place-holding bookings in it.
afterEach(async () => {
  const counters = await db.select().from(slotCounters);
  const holding = await db
    .select({ startsAt: bookings.startsAt, count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(inArray(bookings.status, [...PLACE_HOLDING_STATUSES]))
    .groupBy(bookings.startsAt);
  const counted = new Map(holding.map((row) => [row.startsAt.getTime(), row.count]));
  for (const counter of counters) expect(counter.reserved).toBe(counted.get(counter.startsAt.getTime()) ?? 0);
  for (const [time, count] of counted) expect(counters.find((c) => c.startsAt.getTime() === time)?.reserved).toBe(count);
});

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";
const SLOT = new Date("2026-11-24T04:30:00.000Z"); // 24 Nov, 10:00 India time
const beforeSlot = fixedClock(new Date("2026-11-23T06:00:00.000Z"));
const afterSlotStart = fixedClock(new Date("2026-11-24T05:00:00.000Z"));
let codes = 0;

/** A booking of Asha's in SLOT with its place taken (the slot counter), as the customer's save leaves it. */
async function book({
  status = "booked" as BookingStatus,
  jobStatus = null as JobStatus | null,
  assigned = null as string | null,
  startsAt = SLOT,
} = {}): Promise<{ id: string; code: string }> {
  codes += 1;
  const code = `K7Q4${"ABCDEFGHJKMNPQRSTUVWXYZ"[codes % 23]}${"23456789"[Math.floor(codes / 23) % 8]}`;
  const [row] = await db
    .insert(bookings)
    .values({
      code,
      userId: "asha",
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB1234",
      startsAt,
      isEstimate: true,
      requestToken: randomUUID(),
      status,
      jobStatus,
      assignedMechanicId: assigned,
    })
    .returning({ id: bookings.id });
  await db.insert(bookingEvents).values({ bookingId: row!.id, kind: "booked", actorUserId: "asha" });
  await db.insert(bookingItems).values({
    bookingId: row!.id,
    serviceId: "brakes",
    serviceKind: "service",
    name: { en: "Brakes" },
    priceStatus: "no-price",
    position: 0,
  });
  if (status !== "cancelled") {
    await db
      .insert(slotCounters)
      .values({ startsAt, reserved: 1 })
      .onConflictDoUpdate({ target: slotCounters.startsAt, set: { reserved: sql`${slotCounters.reserved} + 1` } });
  }
  return { id: row!.id, code };
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: bookings.status, mechanic: bookings.assignedMechanicId })
    .from(bookings)
    .where(eq(bookings.id, id));
  return row!;
}

async function reservedAt(startsAt = SLOT): Promise<number> {
  const [row] = await db.select({ reserved: slotCounters.reserved }).from(slotCounters).where(eq(slotCounters.startsAt, startsAt));
  return row?.reserved ?? 0;
}

/** The staff events of a booking (not the "booked" one), oldest first. */
async function staffEvents(bookingId: string) {
  return db
    .select({
      kind: bookingEvents.kind,
      actor: bookingEvents.actorUserId,
      newStatus: bookingEvents.newStatus,
      reason: bookingEvents.reason,
      mechanicId: bookingEvents.mechanicId,
      requestToken: bookingEvents.requestToken,
    })
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, bookingId), sql`${bookingEvents.kind}::text <> 'booked'`))
    .orderBy(bookingEvents.createdAt, bookingEvents.id);
}

function change(bookingId: string, to: string, extra: { reason?: string; requestToken?: string } = {}) {
  return { bookingId, to, requestToken: randomUUID(), ...extra };
}

describe("changeBookingStatus", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: refused before the database is opened", async (_label, user) => {
    logIn(user);
    await expect(changeBookingStatus(change(unknownId, "confirmed"))).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a customer with a bad reason is refused too: access comes before the input check", async () => {
    logIn(asha);
    await expect(changeBookingStatus(change("not-a-uuid", "cancelled", { reason: "" }))).rejects.toBeInstanceOf(AccessDeniedError);
  });

  test("the owner may change a status too", async () => {
    logIn(omar);
    const booking = await book();
    expect(await changeBookingStatus(change(booking.id, "confirmed"), beforeSlot)).toMatchObject({ status: "changed" });
  });

  test("Confirm: booked becomes confirmed, one event with the actor, the counter unchanged", async () => {
    const booking = await book();
    const token = randomUUID();
    const result = await changeBookingStatus(change(booking.id, "confirmed", { requestToken: token }), beforeSlot);
    expect(result).toEqual({ status: "changed", code: booking.code, bookingStatus: "confirmed" });
    expect((await statusOf(booking.id)).status).toBe("confirmed");
    expect(await staffEvents(booking.id)).toEqual([
      { kind: "status-change", actor: "manu", newStatus: "confirmed", reason: null, mechanicId: null, requestToken: token },
    ]);
    expect(await reservedAt()).toBe(1);
  });

  test("Cancel with a reason: cancelled, the place freed, the event holds the cleaned reason", async () => {
    const booking = await book({ status: "confirmed" });
    const result = await changeBookingStatus(change(booking.id, "cancelled", { reason: "  Customer called  " }), beforeSlot);
    expect(result).toEqual({ status: "changed", code: booking.code, bookingStatus: "cancelled" });
    expect((await statusOf(booking.id)).status).toBe("cancelled");
    expect(await reservedAt()).toBe(0);
    expect(await staffEvents(booking.id)).toMatchObject([{ kind: "status-change", newStatus: "cancelled", reason: "Customer called" }]);
  });

  test("a cancel whose slot holds no place (counters and bookings disagree) throws and writes nothing", async () => {
    const booking = await book();
    await db.delete(slotCounters);
    await expect(changeBookingStatus(change(booking.id, "cancelled", { reason: "Customer called" }), beforeSlot)).rejects.toThrow();
    expect((await statusOf(booking.id)).status).toBe("booked");
    expect(await staffEvents(booking.id)).toEqual([]);
    // Put the place back so the counters check after each test holds.
    await db.insert(slotCounters).values({ startsAt: SLOT, reserved: 1 });
  });

  test("a cancel after the slot has passed is still allowed (a customer phoning the day after)", async () => {
    const booking = await book();
    const result = await changeBookingStatus(change(booking.id, "cancelled", { reason: "Phoned late" }), afterSlotStart);
    expect(result).toMatchObject({ status: "changed" });
    expect(await reservedAt()).toBe(0);
  });

  test("a reason sent with another status is ignored", async () => {
    const booking = await book();
    const result = await changeBookingStatus(change(booking.id, "confirmed", { reason: "x" }), beforeSlot);
    expect(result).toMatchObject({ status: "changed" });
    expect(await staffEvents(booking.id)).toMatchObject([{ newStatus: "confirmed", reason: null }]);
  });

  test("Cancel a booking whose job started: job-started, nothing written, the counter unchanged", async () => {
    const booking = await book({ jobStatus: "inspection" });
    const result = await changeBookingStatus(change(booking.id, "cancelled", { reason: "Changed mind" }), beforeSlot);
    expect(result).toEqual({ status: "job-started", code: booking.code });
    expect((await statusOf(booking.id)).status).toBe("booked");
    expect(await staffEvents(booking.id)).toEqual([]);
    expect(await reservedAt()).toBe(1);
  });

  test("No-show before the slot starts: too-early, nothing written", async () => {
    const booking = await book();
    expect(await changeBookingStatus(change(booking.id, "no-show"), beforeSlot)).toEqual({ status: "too-early", code: booking.code });
    expect((await statusOf(booking.id)).status).toBe("booked");
    expect(await staffEvents(booking.id)).toEqual([]);
  });

  test("No-show once the slot started: no-show, the place still taken", async () => {
    const booking = await book({ status: "confirmed" });
    // The slot's start itself counts as started.
    const result = await changeBookingStatus(change(booking.id, "no-show"), fixedClock(SLOT));
    expect(result).toEqual({ status: "changed", code: booking.code, bookingStatus: "no-show" });
    expect((await statusOf(booking.id)).status).toBe("no-show");
    expect(await reservedAt()).toBe(1);
  });

  test("Arrived after all: no-show back to confirmed, the counter unchanged", async () => {
    const booking = await book({ status: "no-show" });
    const result = await changeBookingStatus(change(booking.id, "confirmed"), afterSlotStart);
    expect(result).toEqual({ status: "changed", code: booking.code, bookingStatus: "confirmed" });
    expect(await reservedAt()).toBe(1);
  });

  test.each([
    ["cancelled", "confirmed"],
    ["confirmed", "confirmed"],
    ["no-show", "cancelled"],
    ["cancelled", "cancelled"],
  ] as const)("%s to %s: not-allowed, nothing written", async (from, to) => {
    const booking = await book({ status: from });
    const result = await changeBookingStatus(change(booking.id, to, { reason: "Some reason" }), afterSlotStart);
    expect(result).toEqual({ status: "not-allowed", code: booking.code });
    expect((await statusOf(booking.id)).status).toBe(from);
    expect(await staffEvents(booking.id)).toEqual([]);
  });

  test("the same token twice: the second answers duplicate, one event, the place freed once", async () => {
    const booking = await book();
    const sent = change(booking.id, "cancelled", { reason: "Customer called" });
    expect(await changeBookingStatus(sent, beforeSlot)).toMatchObject({ status: "changed" });
    expect(await changeBookingStatus(sent, beforeSlot)).toEqual({ status: "duplicate", code: booking.code, bookingStatus: "cancelled" });
    expect(await staffEvents(booking.id)).toHaveLength(1);
    expect(await reservedAt()).toBe(0);
  });

  test("a retried no-show after the customer arrived answers duplicate with the status as it now is", async () => {
    const booking = await book();
    const sent = change(booking.id, "no-show");
    await changeBookingStatus(sent, afterSlotStart);
    await changeBookingStatus(change(booking.id, "confirmed"), afterSlotStart);
    expect(await changeBookingStatus(sent, afterSlotStart)).toEqual({ status: "duplicate", code: booking.code, bookingStatus: "confirmed" });
    expect(await staffEvents(booking.id)).toHaveLength(2);
  });

  test("the same token with a different choice (confirm after a cancel's token): stale, nothing written", async () => {
    const booking = await book();
    const token = randomUUID();
    await changeBookingStatus(change(booking.id, "cancelled", { reason: "Customer called", requestToken: token }), beforeSlot);
    expect(await changeBookingStatus(change(booking.id, "confirmed", { requestToken: token }), beforeSlot)).toEqual({
      status: "stale",
      code: booking.code,
    });
    expect((await statusOf(booking.id)).status).toBe("cancelled");
    expect(await staffEvents(booking.id)).toHaveLength(1);
  });

  test("a token first used to assign a mechanic, sent with a status change: stale", async () => {
    const booking = await book();
    const token = randomUUID();
    await assignMechanic({ bookingId: booking.id, mechanicId: "mona", requestToken: token });
    expect(await changeBookingStatus(change(booking.id, "confirmed", { requestToken: token }), beforeSlot)).toEqual({
      status: "stale",
      code: booking.code,
    });
    expect((await statusOf(booking.id)).status).toBe("booked");
  });

  test("two cancels with different tokens at once: one changed, one not-allowed, the place freed once", async () => {
    // Bare database calls, not a transaction per call, so the two saves'
    // queries could interleave (see document/solutions/conventions/pglite-
    // parallel-tests-bare-database-not-transaction-per-call.md). Each save
    // opens its own transaction, and PGlite runs one at a time, so this can't
    // prove the real row race on Postgres: task 20 does that on staging.
    const booking = await book();
    const results = await Promise.all([
      changeBookingStatus(change(booking.id, "cancelled", { reason: "First" }), beforeSlot),
      changeBookingStatus(change(booking.id, "cancelled", { reason: "Second" }), beforeSlot),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["changed", "not-allowed"]);
    expect(await reservedAt()).toBe(0);
    expect(await staffEvents(booking.id)).toHaveLength(1);
  });

  test.each([
    ["", "reason-too-short"],
    ["ab", "reason-too-short"],
    ["x".repeat(201), "reason-too-long"],
  ])("a cancel reason %j: problems, no database opened", async (reason, problem) => {
    const result = await changeBookingStatus(change(unknownId, "cancelled", { reason }), beforeSlot);
    expect(result).toEqual({ status: "problems", problems: [{ field: "reason", problem }] });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a cancel with no reason at all: reason-too-short", async () => {
    const result = await changeBookingStatus({ bookingId: unknownId, to: "cancelled", requestToken: randomUUID() });
    expect(result).toEqual({ status: "problems", problems: [{ field: "reason", problem: "reason-too-short" }] });
  });

  test.each(["booked", "paid", ""])("a status staff can't set (%j): problems, no database opened", async (to) => {
    const result = await changeBookingStatus(change(unknownId, to));
    expect(result).toEqual({ status: "problems", problems: [{ field: "status", problem: "bad-status" }] });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a token that isn't a uuid: problems, no database opened", async () => {
    const result = await changeBookingStatus(change(unknownId, "confirmed", { requestToken: "abc" }));
    expect(result).toEqual({ status: "problems", problems: [{ field: "token", problem: "bad-token" }] });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("an id that isn't a uuid: not-found without a query", async () => {
    expect(await changeBookingStatus(change("not-a-uuid", "confirmed"))).toEqual({ status: "not-found" });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a missing booking: not-found", async () => {
    await book();
    expect(await changeBookingStatus(change(unknownId, "confirmed"), beforeSlot)).toEqual({ status: "not-found" });
  });
});

describe("assignMechanic", () => {
  function assign(bookingId: string, mechanicId: string | null, requestToken: string = randomUUID()) {
    return { bookingId, mechanicId, requestToken };
  }

  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: refused before the database is opened", async (_label, user) => {
    logIn(user);
    await expect(assignMechanic(assign(unknownId, "mona"))).rejects.toBeInstanceOf(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("assign, change, then set nobody: one event each; the old mechanic's jobs no longer include it", async () => {
    const booking = await book();
    const monaJobs = () =>
      db
        .select({ id: bookings.id })
        .from(bookings)
        .where(jobsOf(mona));

    expect(await assignMechanic(assign(booking.id, "mona"))).toEqual({ status: "changed", code: booking.code, mechanicId: "mona" });
    expect(await monaJobs()).toEqual([{ id: booking.id }]);

    expect(await assignMechanic(assign(booking.id, "mike"))).toEqual({ status: "changed", code: booking.code, mechanicId: "mike" });
    expect(await monaJobs()).toEqual([]);
    expect((await statusOf(booking.id)).mechanic).toBe("mike");

    expect(await assignMechanic(assign(booking.id, null))).toEqual({ status: "changed", code: booking.code, mechanicId: null });
    expect((await statusOf(booking.id)).mechanic).toBeNull();

    expect((await staffEvents(booking.id)).map((e) => [e.kind, e.actor, e.mechanicId])).toEqual([
      ["assigned", "manu", "mona"],
      ["assigned", "manu", "mike"],
      ["assigned", "manu", null],
    ]);
    expect(await reservedAt()).toBe(1);
  });

  test("a started job can still be handed over", async () => {
    const booking = await book({ status: "confirmed", jobStatus: "in-service", assigned: "mona" });
    expect(await assignMechanic(assign(booking.id, "mike"))).toMatchObject({ status: "changed" });
  });

  test.each([
    ["a manager", "manu"],
    ["a customer", "asha"],
    ["a stored owner on another number (a customer now)", "omar"],
    ["a stored mechanic on the owner's number", "otto"],
    ["nobody with that id", "ghost"],
  ])("%s: not-a-mechanic, nothing written", async (_label, mechanicId) => {
    const booking = await book();
    expect(await assignMechanic(assign(booking.id, mechanicId))).toEqual({ status: "not-a-mechanic", code: booking.code });
    expect((await statusOf(booking.id)).mechanic).toBeNull();
    expect(await staffEvents(booking.id)).toEqual([]);
  });

  test("the same mechanic again: unchanged, no event", async () => {
    const booking = await book({ assigned: "mona" });
    expect(await assignMechanic(assign(booking.id, "mona"))).toEqual({ status: "unchanged", code: booking.code });
    const nobody = await book({ startsAt: new Date("2026-11-24T05:30:00.000Z") });
    expect(await assignMechanic(assign(nobody.id, null))).toEqual({ status: "unchanged", code: nobody.code });
    expect(await staffEvents(booking.id)).toEqual([]);
    expect(await staffEvents(nobody.id)).toEqual([]);
  });

  test.each(["cancelled", "no-show"] as const)("a %s booking: not-allowed", async (status) => {
    const booking = await book({ status });
    expect(await assignMechanic(assign(booking.id, "mona"))).toEqual({ status: "not-allowed", code: booking.code });
    expect(await staffEvents(booking.id)).toEqual([]);
  });

  test("a completed job: job-closed", async () => {
    const booking = await book({ status: "confirmed", jobStatus: "completed", assigned: "mona" });
    expect(await assignMechanic(assign(booking.id, "mike"))).toEqual({ status: "job-closed", code: booking.code });
    expect((await statusOf(booking.id)).mechanic).toBe("mona");
  });

  test("the same token twice: duplicate, one event", async () => {
    const booking = await book();
    const sent = assign(booking.id, "mona");
    await assignMechanic(sent);
    expect(await assignMechanic(sent)).toEqual({ status: "duplicate", code: booking.code, mechanicId: "mona" });
    expect(await staffEvents(booking.id)).toHaveLength(1);
  });

  test("a retry after the mechanic was changed again still answers duplicate, with the mechanic as it now is", async () => {
    const booking = await book();
    const sent = assign(booking.id, "mona");
    await assignMechanic(sent);
    await assignMechanic(assign(booking.id, "mike"));
    // "unchanged" (mike again isn't what was sent) and "not-allowed" must not win over the retry.
    expect(await assignMechanic(sent)).toEqual({ status: "duplicate", code: booking.code, mechanicId: "mike" });
  });

  test("a retry after the booking was cancelled still answers duplicate, not not-allowed", async () => {
    const booking = await book();
    const sent = assign(booking.id, "mona");
    await assignMechanic(sent);
    await changeBookingStatus(change(booking.id, "cancelled", { reason: "Customer called" }), beforeSlot);
    expect(await assignMechanic(sent)).toMatchObject({ status: "duplicate" });
  });

  test("the same token with another mechanic: stale, nothing written", async () => {
    const booking = await book();
    const token = randomUUID();
    await assignMechanic(assign(booking.id, "mona", token));
    expect(await assignMechanic(assign(booking.id, "mike", token))).toEqual({ status: "stale", code: booking.code });
    expect((await statusOf(booking.id)).mechanic).toBe("mona");
    expect(await staffEvents(booking.id)).toHaveLength(1);
  });

  test("a token first used for a status change, sent with an assignment: stale", async () => {
    const booking = await book();
    const token = randomUUID();
    await changeBookingStatus(change(booking.id, "confirmed", { requestToken: token }), beforeSlot);
    expect(await assignMechanic(assign(booking.id, "mona", token))).toEqual({ status: "stale", code: booking.code });
  });

  test("an id that isn't a uuid: not-found without a query; a bad token: problems", async () => {
    expect(await assignMechanic(assign("nope", "mona"))).toEqual({ status: "not-found" });
    expect(await assignMechanic(assign(unknownId, "mona", "abc"))).toEqual({
      status: "problems",
      problems: [{ field: "token", problem: "bad-token" }],
    });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a missing booking: not-found", async () => {
    expect(await assignMechanic(assign(unknownId, "mona"))).toEqual({ status: "not-found" });
  });
});
