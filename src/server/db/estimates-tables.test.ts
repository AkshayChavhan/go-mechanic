import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { ESTIMATE_LINE_KINDS, ESTIMATE_RULES } from "@/domain/estimates";
import { PRICE_RULES } from "@/domain/money";

import { closeDatabase, createDatabase, type Database } from "./index";
import { bookings, estimateLineKind, estimateLines, estimates, services, users } from "./schema";

// Starting PGlite and migrating it takes a few seconds, and much longer when
// the full test run shares a busy machine: database test files get the
// longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The estimate tables and their rules (task 33), on a real Postgres. A fresh
// in-memory database migrates from 0000 to the last migration, as
// `npm run dev` and every build do, and seeds the services a line can point to.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(estimates);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("manu", "+919876500004", "manager")]);
});

function user(id: string, phoneNumber: string, role: "customer" | "manager" = "customer") {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber, role };
}

const SLOT = new Date("2027-03-12T04:30:00.000Z");
const SENT = new Date("2027-03-12T06:00:00.000Z");
const LATER = new Date("2027-03-12T07:00:00.000Z");

/** A fresh random token, as each form makes one. */
const token = () => crypto.randomUUID();

async function saveBooking(): Promise<string> {
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
      requestToken: token(),
    })
    .returning({ id: bookings.id });
  return row.id;
}

/** A version by the manager: a draft unless the overrides send it. */
function version(bookingId: string, number: number, parts: Partial<typeof estimates.$inferInsert> = {}): typeof estimates.$inferInsert {
  return { bookingId, version: number, createdBy: "manu", createToken: token(), ...parts };
}

/** The three columns a send sets together. */
const sent = (at: Date = SENT) => ({ sentAt: at, sentBy: "manu", sendToken: token() });

async function saveVersion(bookingId: string, number: number, parts: Partial<typeof estimates.$inferInsert> = {}): Promise<string> {
  const [row] = await db.insert(estimates).values(version(bookingId, number, parts)).returning({ id: estimates.id });
  return row.id;
}

function line(estimateId: string, parts: Partial<typeof estimateLines.$inferInsert> = {}): typeof estimateLines.$inferInsert {
  return {
    estimateId,
    position: 0,
    kind: "part",
    description: "Front brake pads",
    amountPaise: 150_000,
    needed: true,
    addedBy: "manu",
    requestToken: token(),
    ...parts,
  };
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
const uniqueViolation = (constraint: string) => ({ code: "23505", constraint });

test("the line kinds match ESTIMATE_LINE_KINDS", () => {
  expect(estimateLineKind.enumValues).toEqual([...ESTIMATE_LINE_KINDS]);
});

describe("estimates: versions", () => {
  test("a booking takes a superseded version, a sent one and a draft, each with lines", async () => {
    const bookingId = await saveBooking();
    const first = await saveVersion(bookingId, 1, { ...sent(), supersededAt: LATER });
    const second = await saveVersion(bookingId, 2, sent(LATER));
    const third = await saveVersion(bookingId, 3);
    const [original] = await db
      .insert(estimateLines)
      .values(line(first, { kind: "labour", needed: false, serviceId: "brakes" }))
      .returning({ id: estimateLines.id });
    await db.insert(estimateLines).values([
      line(second, { copiedFromLineId: original.id, requestToken: null }),
      line(third, { copiedFromLineId: original.id, requestToken: null }),
      line(third, { position: 1 }),
    ]);
    const rows = await db.select({ version: estimates.version }).from(estimates).where(eq(estimates.bookingId, bookingId));
    expect(rows.map((row) => row.version).sort()).toEqual([1, 2, 3]);
    expect(await db.select().from(estimateLines)).toHaveLength(4);
  });

  test("a second draft for the same booking is refused", async () => {
    const bookingId = await saveBooking();
    await saveVersion(bookingId, 1);
    expect(await violation(db.insert(estimates).values(version(bookingId, 2)))).toEqual(
      uniqueViolation("estimates_one_draft_per_booking"),
    );
  });

  test("a second current sent version is refused; superseding the first lets it in", async () => {
    const bookingId = await saveBooking();
    const first = await saveVersion(bookingId, 1, sent());
    const second = await saveVersion(bookingId, 2);
    // Marking the draft sent first would hold two current versions for a statement.
    expect(await violation(db.update(estimates).set(sent(LATER)).where(eq(estimates.id, second)))).toEqual(
      uniqueViolation("estimates_one_current_per_booking"),
    );
    // A send's real order: supersede the earlier version, then mark the draft sent.
    await db.update(estimates).set({ supersededAt: LATER }).where(eq(estimates.id, first));
    await db.update(estimates).set(sent(LATER)).where(eq(estimates.id, second));
  });

  test("another booking's draft and current version don't count", async () => {
    const one = await saveBooking();
    await db.update(bookings).set({ code: "K7Q4MA" }).where(eq(bookings.id, one));
    const other = await saveBooking();
    await saveVersion(one, 1, sent());
    await saveVersion(one, 2);
    await saveVersion(other, 1, sent());
    await saveVersion(other, 2);
  });

  test("the same version number twice for one booking is refused", async () => {
    const bookingId = await saveBooking();
    await saveVersion(bookingId, 1, sent());
    expect(await violation(db.insert(estimates).values(version(bookingId, 1)))).toEqual(uniqueViolation("estimates_booking_version"));
  });

  test("version 0 and a negative revision are refused", async () => {
    const bookingId = await saveBooking();
    expect(await violation(db.insert(estimates).values(version(bookingId, 0)))).toEqual(checkViolation("estimates_version_positive"));
    expect(await violation(db.insert(estimates).values(version(bookingId, 1, { revision: -1 })))).toEqual(
      checkViolation("estimates_revision_not_negative"),
    );
  });

  test("a send must set its time, its sender and its token together", async () => {
    const bookingId = await saveBooking();
    expect(await violation(db.insert(estimates).values(version(bookingId, 1, { sentAt: SENT })))).toEqual(
      checkViolation("estimates_send_complete"),
    );
    expect(await violation(db.insert(estimates).values(version(bookingId, 1, { sentAt: SENT, sentBy: "manu" })))).toEqual(
      checkViolation("estimates_send_complete"),
    );
    expect(await violation(db.insert(estimates).values(version(bookingId, 1, { sentBy: "manu", sendToken: token() })))).toEqual(
      checkViolation("estimates_send_complete"),
    );
  });

  test("only a sent version can be superseded", async () => {
    const bookingId = await saveBooking();
    expect(await violation(db.insert(estimates).values(version(bookingId, 1, { supersededAt: LATER })))).toEqual(
      checkViolation("estimates_superseded_after_send"),
    );
  });

  test("one person's create or send token can't be used twice", async () => {
    const one = await saveBooking();
    await db.update(bookings).set({ code: "K7Q4MA" }).where(eq(bookings.id, one));
    const other = await saveBooking();
    const createToken = token();
    const sendToken = token();
    await saveVersion(one, 1, { createToken, sentAt: SENT, sentBy: "manu", sendToken });
    expect(await violation(db.insert(estimates).values(version(other, 1, { createToken })))).toEqual(
      uniqueViolation("estimates_created_by_create_token"),
    );
    expect(await violation(db.insert(estimates).values(version(other, 1, { sentAt: SENT, sentBy: "manu", sendToken })))).toEqual(
      uniqueViolation("estimates_sent_by_send_token"),
    );
  });
});

describe("estimate_lines", () => {
  test("the amount's limits match PRICE_RULES", async () => {
    const estimateId = await saveVersion(await saveBooking(), 1);
    expect(await violation(db.insert(estimateLines).values(line(estimateId, { amountPaise: PRICE_RULES.minPaise - 1 })))).toEqual(
      checkViolation("estimate_lines_amount_range"),
    );
    expect(await violation(db.insert(estimateLines).values(line(estimateId, { amountPaise: PRICE_RULES.maxPaise + 1 })))).toEqual(
      checkViolation("estimate_lines_amount_range"),
    );
    await db.insert(estimateLines).values([
      line(estimateId, { amountPaise: PRICE_RULES.minPaise }),
      line(estimateId, { amountPaise: PRICE_RULES.maxPaise, position: 1 }),
    ]);
  });

  test("the description's length limits match ESTIMATE_RULES", async () => {
    const estimateId = await saveVersion(await saveBooking(), 1);
    const { descriptionMaxLength } = ESTIMATE_RULES;
    expect(await violation(db.insert(estimateLines).values(line(estimateId, { description: "" })))).toEqual(
      checkViolation("estimate_lines_description_length"),
    );
    expect(
      await violation(db.insert(estimateLines).values(line(estimateId, { description: "a".repeat(descriptionMaxLength + 1) }))),
    ).toEqual(checkViolation("estimate_lines_description_length"));
    await db.insert(estimateLines).values(line(estimateId, { description: "a".repeat(descriptionMaxLength) }));
  });

  test("a negative position is refused", async () => {
    const estimateId = await saveVersion(await saveBooking(), 1);
    expect(await violation(db.insert(estimateLines).values(line(estimateId, { position: -1 })))).toEqual(
      checkViolation("estimate_lines_position_not_negative"),
    );
  });

  test("one person's add-line token can't be used twice; copies carry none", async () => {
    const estimateId = await saveVersion(await saveBooking(), 1);
    const requestToken = token();
    await db.insert(estimateLines).values(line(estimateId, { requestToken }));
    expect(await violation(db.insert(estimateLines).values(line(estimateId, { requestToken, position: 1 })))).toEqual(
      uniqueViolation("estimate_lines_added_by_request_token"),
    );
    await db.insert(estimateLines).values([
      line(estimateId, { requestToken: null, position: 1 }),
      line(estimateId, { requestToken: null, position: 2 }),
    ]);
  });

  test("a service a line was taken from can't be deleted", async () => {
    const estimateId = await saveVersion(await saveBooking(), 1);
    await db.insert(estimateLines).values(line(estimateId, { serviceId: "brakes" }));
    expect(await violation(db.delete(services).where(eq(services.id, "brakes")))).toEqual({
      code: "23001",
      constraint: "estimate_lines_service_id_services_id_fk",
    });
  });
});

test("deleting the booking deletes its estimates and their lines", async () => {
  const bookingId = await saveBooking();
  const first = await saveVersion(bookingId, 1, sent());
  const second = await saveVersion(bookingId, 2);
  const [original] = await db.insert(estimateLines).values(line(first)).returning({ id: estimateLines.id });
  await db.insert(estimateLines).values(line(second, { copiedFromLineId: original.id, requestToken: null }));
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  expect(await db.select().from(estimates)).toEqual([]);
  expect(await db.select().from(estimateLines)).toEqual([]);
});
