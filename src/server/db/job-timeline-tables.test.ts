import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { JOB_STATUSES, JOB_UPDATE_RULES } from "@/domain/jobs";

import { closeDatabase, createDatabase, type Database } from "./index";
import { bookingEvents, bookings, jobStatus, photoSets, users } from "./schema";

// Starting PGlite and migrating it takes a few seconds, and much longer when
// the full test run shares a busy machine: database test files get the
// longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The job columns' own rules (task 31), on a real Postgres. A fresh in-memory
// database for the file migrates from 0000 to the last migration in one run,
// which is also how `npm run dev` and every build start: that's the proof
// that migration 0010 never uses its new "job-update" enum value before it's
// committed.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(bookingEvents);
  await db.delete(photoSets);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("mona", "+919876500003", "mechanic"), user("manu", "+919876500004", "manager")]);
});

function user(id: string, phoneNumber: string, role: "customer" | "mechanic" | "manager" = "customer") {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber, role };
}

const TOKEN = "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30";
const OTHER_TOKEN = "0b8f8e0e-3c1d-4d3a-8f55-1a2b3c4d5e6f";

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
      startsAt: new Date("2027-03-12T04:30:00.000Z"),
      isEstimate: false,
      totalPaise: 150_000,
      requestToken: TOKEN,
      ...overrides,
    })
    .returning({ id: bookings.id });
  return row.id;
}

async function jobSet(bookingId: string): Promise<string> {
  const [row] = await db.insert(photoSets).values({ userId: "asha", bookingId }).returning({ id: photoSets.id });
  return row.id;
}

function update(bookingId: string, overrides: Partial<typeof bookingEvents.$inferInsert> = {}): typeof bookingEvents.$inferInsert {
  return { bookingId, kind: "job-update", actorUserId: "mona", jobStatus: "vehicle-received", requestToken: TOKEN, ...overrides };
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

const uniqueViolation = (constraint: string) => ({ code: "23505", constraint });
const checkViolation = (constraint: string) => ({ code: "23514", constraint });
const restrictViolation = (constraint: string) => ({ code: "23001", constraint });

test("the job_status enum lists the steps exactly as the app does", () => {
  expect(jobStatus.enumValues).toEqual([...JOB_STATUSES]);
});

test("a fresh database takes a job update after migrating (the new enum value is usable)", async () => {
  const id = await saveBooking({ jobStatus: "inspection", assignedMechanicId: "mona" });
  await db.insert(bookingEvents).values(update(id, { jobStatus: "inspection", note: "Pads worn" }));
  const [row] = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, id));
  expect(row).toMatchObject({ kind: "job-update", jobStatus: "inspection", note: "Pads worn", hadPhotos: false });
});

describe("booking_events", () => {
  test("a job update with nothing in it is refused", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(update(id, { jobStatus: null })))).toEqual(
      checkViolation("booking_events_job_update_has_content"),
    );
  });

  test("a photos-only update stays after its set is deleted, with no set and had_photos still true", async () => {
    const id = await saveBooking();
    const set = await jobSet(id);
    await db.insert(bookingEvents).values(update(id, { jobStatus: null, photoSetId: set, hadPhotos: true }));
    await db.delete(photoSets).where(eq(photoSets.id, set));
    const [row] = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, id));
    expect(row).toMatchObject({ photoSetId: null, hadPhotos: true, jobStatus: null });
  });

  test("a set without the photos flag is refused", async () => {
    const id = await saveBooking();
    const set = await jobSet(id);
    expect(await violation(db.insert(bookingEvents).values(update(id, { photoSetId: set })))).toEqual(
      checkViolation("booking_events_photos_flag"),
    );
  });

  test.each([
    [{ note: "Hello" }],
    [{ jobStatus: "inspection" as const }],
    [{ requestToken: TOKEN }],
    [{ hadPhotos: true }],
  ])("a booked entry with job parts (%o) is refused", async (parts) => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values({ bookingId: id, kind: "booked", actorUserId: "asha", ...parts }))).toEqual(
      checkViolation("booking_events_booked_is_plain"),
    );
  });

  test("a plain booked entry, as the booking save writes it, is fine", async () => {
    const id = await saveBooking();
    await db.insert(bookingEvents).values({ bookingId: id, kind: "booked", actorUserId: "asha" });
    expect(await db.$count(bookingEvents)).toBe(1);
  });

  test("a note is 1 to 1,000 characters, counted as characters", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(bookingEvents).values(update(id, { note: "" })))).toEqual(checkViolation("booking_events_note_length"));
    expect(
      await violation(db.insert(bookingEvents).values(update(id, { note: "x".repeat(JOB_UPDATE_RULES.noteMaxLength + 1) }))),
    ).toEqual(checkViolation("booking_events_note_length"));
    await db.insert(bookingEvents).values(update(id, { note: "🔧".repeat(JOB_UPDATE_RULES.noteMaxLength) }));
  });

  test("one actor can't use one token twice; another actor can", async () => {
    const id = await saveBooking();
    await db.insert(bookingEvents).values(update(id));
    expect(await violation(db.insert(bookingEvents).values(update(id, { jobStatus: "inspection" })))).toEqual(
      uniqueViolation("booking_events_actor_request_token"),
    );
    await db.insert(bookingEvents).values(update(id, { actorUserId: "manu", jobStatus: "inspection" }));
    // Untokened entries (every "booked" one) don't clash: NULLs are distinct.
    await db.insert(bookingEvents).values({ bookingId: id, kind: "booked", actorUserId: "asha" });
    await db.insert(bookingEvents).values({ bookingId: id, kind: "booked", actorUserId: "asha" });
  });

  test("two updates can't share one photo set", async () => {
    const id = await saveBooking();
    const set = await jobSet(id);
    await db.insert(bookingEvents).values(update(id, { photoSetId: set, hadPhotos: true }));
    expect(
      await violation(db.insert(bookingEvents).values(update(id, { photoSetId: set, hadPhotos: true, requestToken: OTHER_TOKEN }))),
    ).toEqual(uniqueViolation("booking_events_photo_set_id_unique"));
  });
});

describe("bookings and photo sets", () => {
  test("a booking with a job photo set can't be deleted", async () => {
    const id = await saveBooking();
    await jobSet(id);
    expect(await violation(db.delete(bookings).where(eq(bookings.id, id)))).toEqual(
      restrictViolation("photo_sets_booking_id_bookings_id_fk"),
    );
  });

  test("deleting the assigned mechanic's user unassigns the job", async () => {
    const id = await saveBooking({ assignedMechanicId: "mona" });
    await db.delete(users).where(eq(users.id, "mona"));
    const [row] = await db.select({ assigned: bookings.assignedMechanicId }).from(bookings).where(eq(bookings.id, id));
    expect(row.assigned).toBeNull();
  });

  test("a new booking starts not started and unassigned", async () => {
    const id = await saveBooking();
    const [row] = await db
      .select({ jobStatus: bookings.jobStatus, assigned: bookings.assignedMechanicId })
      .from(bookings)
      .where(eq(bookings.id, id));
    expect(row).toEqual({ jobStatus: null, assigned: null });
  });
});
