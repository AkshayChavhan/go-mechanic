import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { NAME_MAX_LENGTH } from "@/domain/profile";
import { REVIEW_RULES } from "@/domain/reviews";

import { closeDatabase, createDatabase, type Database } from "./index";
import { bookings, reviews, users } from "./schema";

// Starting PGlite and migrating it takes a few seconds, and much longer when
// the full test run shares a busy machine: database test files get the
// longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The reviews table's own rules (task 37), on a real Postgres: the save
// relies on them as a backstop.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("manu", "+919876500004")]);
});

function user(id: string, phoneNumber: string) {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber };
}

const TOKEN = "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30";
const OTHER_TOKEN = "0b8f8e0e-3c1d-4d3a-8f55-1a2b3c4d5e6f";

async function saveBooking(code = "K7Q4MX"): Promise<string> {
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
      startsAt: new Date("2027-03-12T04:30:00.000Z"),
      isEstimate: true,
      requestToken: randomUUID(),
      jobStatus: "completed",
    })
    .returning({ id: bookings.id });
  return row!.id;
}

function review(bookingId: string, overrides: Partial<typeof reviews.$inferInsert> = {}): typeof reviews.$inferInsert {
  return { bookingId, userId: "asha", rating: 5, comment: "Great work", shownName: "Asha", requestToken: TOKEN, ...overrides };
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

test("the limits match the app's rules", () => {
  expect(REVIEW_RULES.commentMaxLength).toBe(1000);
  expect(NAME_MAX_LENGTH).toBe(60);
});

describe("the reviews table", () => {
  test("a booking gets one review", async () => {
    const id = await saveBooking();
    await db.insert(reviews).values(review(id));
    expect(await violation(db.insert(reviews).values(review(id, { requestToken: OTHER_TOKEN })))).toEqual(
      uniqueViolation("reviews_booking_id_unique"),
    );
  });

  test("one customer can't use one token twice", async () => {
    const first = await saveBooking();
    const second = await saveBooking("K7Q4MY");
    await db.insert(reviews).values(review(first));
    expect(await violation(db.insert(reviews).values(review(second)))).toEqual(uniqueViolation("reviews_user_request_token"));
  });

  test.each([0, 6])("a rating of %i is refused", async (rating) => {
    const id = await saveBooking();
    expect(await violation(db.insert(reviews).values(review(id, { rating })))).toEqual(checkViolation("reviews_rating_range"));
  });

  test("a comment is 1 to 1,000 characters or null, counted as characters", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(reviews).values(review(id, { comment: "" })))).toEqual(checkViolation("reviews_comment_length"));
    expect(await violation(db.insert(reviews).values(review(id, { comment: "x".repeat(1001) })))).toEqual(
      checkViolation("reviews_comment_length"),
    );
    await db.insert(reviews).values(review(id, { comment: "🚗".repeat(1000) }));
    await db.delete(reviews);
    await db.insert(reviews).values(review(id, { comment: null }));
  });

  test("the shown name is 1 to 60 characters", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(reviews).values(review(id, { shownName: "" })))).toEqual(checkViolation("reviews_shown_name_length"));
    expect(await violation(db.insert(reviews).values(review(id, { shownName: "x".repeat(61) })))).toEqual(
      checkViolation("reviews_shown_name_length"),
    );
  });

  test("a reply is 1 to 1,000 characters and comes with its time", async () => {
    const id = await saveBooking();
    expect(await violation(db.insert(reviews).values(review(id, { reply: "", repliedAt: new Date() })))).toEqual(
      checkViolation("reviews_reply_length"),
    );
    expect(await violation(db.insert(reviews).values(review(id, { reply: "Thanks" })))).toEqual(checkViolation("reviews_reply_complete"));
    expect(await violation(db.insert(reviews).values(review(id, { repliedAt: new Date() })))).toEqual(
      checkViolation("reviews_reply_complete"),
    );
    await db.insert(reviews).values(review(id, { reply: "Thanks, Asha", repliedAt: new Date(), repliedBy: "manu" }));
  });

  test("deleting the booking deletes its review", async () => {
    const id = await saveBooking();
    await db.insert(reviews).values(review(id));
    await db.delete(bookings).where(eq(bookings.id, id));
    expect(await db.$count(reviews)).toBe(0);
  });

  test("deleting the staff member who hid or replied keeps the review and clears their name", async () => {
    const id = await saveBooking();
    await db.insert(reviews).values(review(id, { hiddenAt: new Date(), hiddenBy: "manu", reply: "Sorry", repliedAt: new Date(), repliedBy: "manu" }));
    await db.delete(users).where(eq(users.id, "manu"));
    const [row] = await db.select().from(reviews);
    expect(row).toMatchObject({ hiddenBy: null, repliedBy: null, reply: "Sorry" });
  });
});
