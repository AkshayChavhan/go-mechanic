import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { ReviewInput } from "@/domain/reviews";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookings, reviews, users } from "@/server/db/schema";

import {
  clearReviewReply,
  createMyReview,
  hideReview,
  listMyCompletedJobs,
  readMyReviewTarget,
  readPublishedReviews,
  setReviewReply,
  showReview,
} from "./reviews";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));

type TestUser = { id: string; phoneNumber: string; role: "customer" | "mechanic" | "manager" | "owner" };
const asha: TestUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const ravi: TestUser = { id: "ravi", phoneNumber: "+919876500002", role: "customer" };
const nina: TestUser = { id: "nina", phoneNumber: "+919876500007", role: "customer" };
const mona: TestUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const manu: TestUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };

function logIn(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";
const clock = fixedClock(new Date("2026-11-19T10:00:00Z"));

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
  codes = 0;
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values(
    [asha, ravi, nina, mona, manu].map(({ id, phoneNumber }) => ({
      id,
      name: id === "asha" ? "Asha Patil" : id === "ravi" ? "Ravi" : id === "nina" ? "" : "Staff",
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
    })),
  );
  logIn(asha);
});

let codes = 0;

/** A booking of `userId`'s at `jobStatus`, with its completing job update when completed; returns its id. */
async function job({ userId = "asha", jobStatus = "completed" as typeof bookings.$inferInsert.jobStatus, completedAt = new Date("2026-11-18T10:00:00Z") } = {}) {
  codes += 1;
  const [row] = await db
    .insert(bookings)
    .values({
      code: `K7Q4${"ABCDEFGHJKMNPQRSTUVWXYZ"[codes % 23]}${"23456789"[codes % 8]}`,
      userId,
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB1234",
      startsAt: new Date("2026-11-18T04:30:00.000Z"),
      isEstimate: true,
      requestToken: randomUUID(),
      jobStatus,
    })
    .returning({ id: bookings.id });
  if (jobStatus === "completed") {
    await db.insert(bookingEvents).values({
      bookingId: row!.id,
      kind: "job-update",
      actorUserId: "mona",
      jobStatus: "completed",
      requestToken: randomUUID(),
      createdAt: completedAt,
    });
  }
  return row!.id;
}

function input(bookingId: string, changes: Partial<ReviewInput> = {}): ReviewInput {
  return { bookingId, rating: "5", comment: "Honest and quick", requestToken: randomUUID(), ...changes };
}

describe("createMyReview", () => {
  test("logged out: AccessDeniedError before the input check or the database", async () => {
    logIn(null);
    await expect(createMyReview(input("x"), clock)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a completed job of the customer's: sent, credited to the first name, and the public read is refreshed", async () => {
    const bookingId = await job();
    const result = await createMyReview(input(bookingId, { rating: "4" }), clock);
    expect(result.status).toBe("sent");
    const [row] = await db.select().from(reviews);
    expect(row).toMatchObject({ bookingId, userId: "asha", rating: 4, comment: "Honest and quick", shownName: "Asha", hiddenAt: null });
    expect(updateTag).toHaveBeenCalledWith("reviews");
  });

  test("another customer's booking, a job not completed and a missing id are the same not-found", async () => {
    const ravis = await job({ userId: "ravi" });
    const unfinished = await job({ jobStatus: "ready" });
    for (const bookingId of [ravis, unfinished, unknownId]) {
      expect(await createMyReview(input(bookingId), clock)).toEqual({ status: "not-found" });
    }
    expect(await db.$count(reviews)).toBe(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  test("the same token again is duplicate, even after staff hid the review", async () => {
    const bookingId = await job();
    const send = input(bookingId);
    const first = await createMyReview(send, clock);
    if (first.status !== "sent") throw new Error(first.status);
    await db.update(reviews).set({ hiddenAt: new Date() });
    expect(await createMyReview(send, clock)).toEqual({ status: "duplicate", id: first.id });
    expect(await db.$count(reviews)).toBe(1);
  });

  test("a retry is duplicate even when the booking no longer passes the lock's filter", async () => {
    // "Completed" is final today, but later moves (task 34's rejected estimate,
    // a correction) could take a booking out of the filter: the caller's own
    // token must still answer first (the idempotent-save lesson).
    const bookingId = await job();
    const send = input(bookingId);
    const first = await createMyReview(send, clock);
    if (first.status !== "sent") throw new Error(first.status);
    await db.update(bookings).set({ jobStatus: "ready" }).where(eq(bookings.id, bookingId));
    expect(await createMyReview(send, clock)).toEqual({ status: "duplicate", id: first.id });
  });

  test("another customer's token is not a duplicate for this one: the lookup is the caller's own", async () => {
    const ashas = await job();
    const token = randomUUID();
    expect((await createMyReview(input(ashas, { requestToken: token }), clock)).status).toBe("sent");
    logIn(ravi);
    const ravis = await job({ userId: "ravi" });
    expect((await createMyReview(input(ravis, { requestToken: token }), clock)).status).toBe("sent");
    expect(await db.$count(reviews)).toBe(2);
  });

  test("a new visit of the form on a reviewed booking is already-reviewed", async () => {
    const bookingId = await job();
    const first = await createMyReview(input(bookingId), clock);
    if (first.status !== "sent") throw new Error(first.status);
    expect(await createMyReview(input(bookingId, { rating: "1" }), clock)).toEqual({ status: "already-reviewed", id: first.id });
  });

  test("a customer with no name gets needs-name and nothing is saved", async () => {
    logIn(nina);
    const bookingId = await job({ userId: "nina" });
    expect(await createMyReview(input(bookingId), clock)).toEqual({ status: "needs-name" });
    expect(await db.$count(reviews)).toBe(0);
  });

  test("input problems come back before the database", async () => {
    expect(await createMyReview(input(unknownId, { rating: "" }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "rating", problem: "rating-missing" }],
    });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("stars only: the comment is null", async () => {
    const bookingId = await job();
    await createMyReview(input(bookingId, { comment: "  " }), clock);
    const [row] = await db.select().from(reviews);
    expect(row!.comment).toBeNull();
  });
});

describe("the customer's reads", () => {
  test("logged out: AccessDeniedError before the database", async () => {
    logIn(null);
    await expect(listMyCompletedJobs()).rejects.toThrow(AccessDeniedError);
    await expect(readMyReviewTarget(unknownId)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("completed jobs: only the customer's, most recently completed first, with their stars", async () => {
    const older = await job({ completedAt: new Date("2026-11-10T10:00:00Z") });
    const newer = await job({ completedAt: new Date("2026-11-18T10:00:00Z") });
    await job({ jobStatus: "in-service" });
    await job({ userId: "ravi" });
    await createMyReview(input(older, { rating: "3" }), clock);
    const rows = await listMyCompletedJobs();
    expect(rows.map((row) => [row.bookingId, row.reviewRating])).toEqual([
      [newer, null],
      [older, 3],
    ]);
    expect(rows[0]).toMatchObject({ kind: "car", makeName: { en: "Honda" }, completedAt: new Date("2026-11-18T10:00:00Z") });
  });

  test("the review page's booking: can-review with the credit, already-reviewed, or not-found", async () => {
    const bookingId = await job();
    expect(await readMyReviewTarget(bookingId)).toEqual({
      status: "can-review",
      bookingId,
      kind: "car",
      makeName: { en: "Honda" },
      shownName: "Asha",
    });
    await createMyReview(input(bookingId, { rating: "4" }), clock);
    expect(await readMyReviewTarget(bookingId)).toEqual({ status: "already-reviewed", bookingId, rating: 4 });
    logIn(ravi);
    expect(await readMyReviewTarget(bookingId)).toEqual({ status: "not-found" });
    expect(await readMyReviewTarget("1; drop")).toEqual({ status: "not-found" });
  });
});

describe("readPublishedReviews", () => {
  test("shown reviews newest first, with the count and average; hidden ones are left out of all three", async () => {
    const ratings = ["5", "4", "4", "1"];
    const ids: string[] = [];
    for (const [index, rating] of ratings.entries()) {
      const bookingId = await job();
      const sent = await createMyReview(input(bookingId, { rating }), fixedClock(new Date(Date.UTC(2026, 10, 19, 10, index))));
      if (sent.status !== "sent") throw new Error(sent.status);
      ids.push(sent.id);
    }
    await db.update(reviews).set({ hiddenAt: new Date() }).where(eq(reviews.id, ids[3]!));
    const published = await readPublishedReviews();
    expect(published.reviews.map((review) => review.id)).toEqual([ids[2], ids[1], ids[0]]);
    expect(published.count).toBe(3);
    expect(published.average).toBe(4.3);
    expect(published.reviews[0]).toMatchObject({ shownName: "Asha", kind: "car", makeName: { en: "Honda" }, reply: null });
  });

  test("none: an empty list, a count of 0 and no average", async () => {
    expect(await readPublishedReviews()).toEqual({ reviews: [], count: 0, average: null });
  });
});

describe("staff hiding and replying", () => {
  async function aReview(): Promise<string> {
    const bookingId = await job();
    const sent = await createMyReview(input(bookingId), clock);
    if (sent.status !== "sent") throw new Error(sent.status);
    vi.mocked(updateTag).mockClear();
    vi.mocked(getDatabase).mockClear();
    return sent.id;
  }

  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: AccessDeniedError before the database, for every staff function", async (_, user) => {
    logIn(user);
    for (const call of [() => hideReview(unknownId), () => showReview(unknownId), () => setReviewReply(unknownId, "Thanks"), () => clearReviewReply(unknownId)]) {
      await expect(call()).rejects.toThrow(AccessDeniedError);
    }
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a manager hides, shows, replies and clears the reply; each refreshes the public read", async () => {
    const id = await aReview();
    logIn(manu);
    expect(await hideReview(id, clock)).toEqual({ status: "changed" });
    expect((await readPublishedReviews()).count).toBe(0);
    expect(await showReview(id)).toEqual({ status: "changed" });
    expect(await setReviewReply(id, "  Thank you, Asha! ", clock)).toEqual({ status: "changed" });
    const [replied] = await db.select().from(reviews);
    expect(replied).toMatchObject({ reply: "Thank you, Asha!", repliedBy: "manu", hiddenAt: null });
    expect((await readPublishedReviews()).reviews[0]!.reply).toBe("Thank you, Asha!");
    expect(await clearReviewReply(id)).toEqual({ status: "changed" });
    expect(updateTag).toHaveBeenCalledTimes(4);
    expect(vi.mocked(updateTag).mock.calls.every(([tag]) => tag === "reviews")).toBe(true);
  });

  test("a missing or malformed id is not-found and refreshes nothing; an empty or long reply is refused", async () => {
    await aReview();
    logIn(manu);
    expect(await hideReview(unknownId)).toEqual({ status: "not-found" });
    expect(await showReview("x")).toEqual({ status: "not-found" });
    expect(await setReviewReply(unknownId, " ")).toEqual({ status: "problems", problem: "reply-missing" });
    expect(await setReviewReply(unknownId, "x".repeat(1001))).toEqual({ status: "problems", problem: "reply-too-long" });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
