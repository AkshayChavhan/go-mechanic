import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { CANCEL_REASON_RULES } from "@/domain/bookings";

import { closeDatabase, createDatabase, type Database } from "./index";
import { bookingEvents, bookings, users } from "./schema";

// Starting PGlite and migrating it takes a few seconds, and much longer when
// the full test run shares a busy machine: database test files get the
// longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The staff changes' columns and their rules (task 27), on a real Postgres.
// A fresh in-memory database migrates from 0000 to the last migration in one
// transaction, as `npm run dev` and every build do: writing each new status
// and event kind here proves migration 0012 never uses a value it adds
// before that value is committed.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(bookingEvents);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("mona", "+919876500003", "mechanic"), user("manu", "+919876500004", "manager")]);
});

function user(id: string, phoneNumber: string, role: "customer" | "mechanic" | "manager" = "customer") {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber, role };
}

const TOKEN = "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30";
const SLOT = new Date("2027-03-12T04:30:00.000Z");
const LATER_SLOT = new Date("2027-03-13T04:30:00.000Z");

async function saveBooking(overrides: Partial<typeof bookings.$inferInsert> = {}): Promise<string> {
  const [row] = await db
    .insert(bookings)
    .values({
      code: "K7Q4MX",
      userId: "asha",
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB1234",
      startsAt: SLOT,
      isEstimate: false,
      totalPaise: 150_000,
      requestToken: TOKEN,
      ...overrides,
    })
    .returning({ id: bookings.id });
  return row.id;
}

/** A staff entry by the manager, with a token, as the staff saves write them. */
function staffEvent(bookingId: string, parts: Partial<typeof bookingEvents.$inferInsert>): typeof bookingEvents.$inferInsert {
  return { bookingId, actorUserId: "manu", requestToken: TOKEN, kind: "status-change", ...parts };
}

async function violation(query: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  if (!(error instanceof DrizzleQueryError)) throw error;
  const { code, constraint } = error.cause as { code?: string; constraint?: string };
  return { code, constraint };
}

const checkViolation = (constraint: string) => ({ code: "23514", constraint });

describe("a fresh database takes every new value after migrating", () => {
  test.each(["confirmed", "cancelled", "no-show"] as const)("a %s booking", async (status) => {
    const id = await saveBooking({ status });
    const [row] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, id));
    expect(row.status).toBe(status);
  });

  test("each new kind of history entry", async () => {
    const id = await saveBooking();
    await db.insert(bookingEvents).values([
      staffEvent(id, { newStatus: "confirmed" }),
      staffEvent(id, { newStatus: "cancelled", reason: "Customer phoned", requestToken: "0b8f8e0e-3c1d-4d3a-8f55-1a2b3c4d5e6f" }),
      staffEvent(id, { newStatus: "no-show", requestToken: "1c9a0e0e-3c1d-4d3a-8f55-1a2b3c4d5e6f" }),
      staffEvent(id, { kind: "rescheduled", movedFrom: SLOT, movedTo: LATER_SLOT, requestToken: "2d0b1f1f-3c1d-4d3a-8f55-1a2b3c4d5e6f" }),
      staffEvent(id, { kind: "assigned", mechanicId: "mona", requestToken: "3e1c2a2a-3c1d-4d3a-8f55-1a2b3c4d5e6f" }),
      staffEvent(id, { kind: "assigned", mechanicId: null, requestToken: "4f2d3b3b-3c1d-4d3a-8f55-1a2b3c4d5e6f" }),
    ]);
    const rows = await db.select({ kind: bookingEvents.kind }).from(bookingEvents).where(eq(bookingEvents.bookingId, id));
    expect(rows).toHaveLength(6);
  });
});

describe("booking_events: staff changes", () => {
  test("a status change without its status is refused", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, {})))).toEqual(
      checkViolation("booking_events_status_change_has_status"),
    );
  });

  test("a cancel without a reason is refused; a confirm with one is refused", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "cancelled" })))).toEqual(
      checkViolation("booking_events_reason_only_on_cancel"),
    );
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "confirmed", reason: "Because" })))).toEqual(
      checkViolation("booking_events_reason_only_on_cancel"),
    );
  });

  test("a staff change without a request token is refused", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "confirmed", requestToken: null })))).toEqual(
      checkViolation("booking_events_staff_change_shape"),
    );
  });

  test("a staff change carrying a job update's parts is refused", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "confirmed", note: "Hi" })))).toEqual(
      checkViolation("booking_events_staff_change_shape"),
    );
  });

  test("a reschedule needs both times, and they must differ", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(staffEvent(id, { kind: "rescheduled", movedFrom: SLOT })))).toEqual(
      checkViolation("booking_events_rescheduled_has_times"),
    );
    expect(
      await violation(db.insert(bookingEvents).values(staffEvent(id, { kind: "rescheduled", movedFrom: SLOT, movedTo: SLOT }))),
    ).toEqual(checkViolation("booking_events_rescheduled_has_times"));
  });

  test("a job update or a booked entry carrying a staff change's parts is refused", async () => {
    const id = await saveBooking();
    const jobUpdate = { bookingId: id, kind: "job-update" as const, actorUserId: "mona", jobStatus: "vehicle-received" as const, requestToken: TOKEN };
    expect(await violation(db.insert(bookingEvents).values({ ...jobUpdate, reason: "Nope" }))).toEqual(
      checkViolation("booking_events_reason_only_on_cancel"),
    );
    expect(await violation(db.insert(bookingEvents).values({ ...jobUpdate, newStatus: "confirmed" }))).toEqual(
      checkViolation("booking_events_status_change_has_status"),
    );
    expect(await violation(db.insert(bookingEvents).values({ ...jobUpdate, movedFrom: SLOT, movedTo: LATER_SLOT }))).toEqual(
      checkViolation("booking_events_rescheduled_has_times"),
    );
    expect(await violation(db.insert(bookingEvents).values({ ...jobUpdate, mechanicId: "mona" }))).toEqual(
      checkViolation("booking_events_mechanic_only_on_assigned"),
    );
  });

  test("the reason's length limits match CANCEL_REASON_RULES", async () => {
    const id = await saveBooking();
    const { minLength, maxLength } = CANCEL_REASON_RULES;
    expect(
      await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "cancelled", reason: "a".repeat(minLength - 1) }))),
    ).toEqual(checkViolation("booking_events_reason_length"));
    expect(
      await violation(db.insert(bookingEvents).values(staffEvent(id, { newStatus: "cancelled", reason: "a".repeat(maxLength + 1) }))),
    ).toEqual(checkViolation("booking_events_reason_length"));
    await db.insert(bookingEvents).values(staffEvent(id, { newStatus: "cancelled", reason: "a".repeat(maxLength) }));
  });

  test("deleting the assigned mechanic keeps the entry, with nobody named", async () => {
    const id = await saveBooking();
    await db.insert(bookingEvents).values(staffEvent(id, { kind: "assigned", mechanicId: "mona", actorUserId: "manu" }));
    await db.delete(users).where(eq(users.id, "mona"));
    const [row] = await db.select({ mechanicId: bookingEvents.mechanicId }).from(bookingEvents).where(eq(bookingEvents.bookingId, id));
    expect(row.mechanicId).toBeNull();
  });
});
