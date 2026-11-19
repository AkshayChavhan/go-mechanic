import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { JobStatus, JobUpdateInput } from "@/domain/jobs";
import { type Clock, fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookingItems, bookings, photoSets, photos, users } from "@/server/db/schema";
import { createFakePhotoStorage } from "@/server/providers/photos/fake";
import { photoSigningKey } from "@/server/providers/photos/token";

import { listMyAssignedJobs, readJob, readMyJobTimeline, updateJob } from "./jobs";
import { finishJobPhotoUpload, startJobPhotoUpload } from "./photos";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));

type TestUser = { id: string; phoneNumber: string; role: "customer" | "mechanic" | "manager" | "owner" };
const asha: TestUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const ravi: TestUser = { id: "ravi", phoneNumber: "+919876500002", role: "customer" };
const mona: TestUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const mike: TestUser = { id: "mike", phoneNumber: "+919876500006", role: "mechanic" };
const manu: TestUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };
const omar: TestUser = { id: "omar", phoneNumber: "+919876500005", role: "owner" };

function logIn(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

const dir = mkdtempSync(path.join(os.tmpdir(), "gomechanic-jobs-dal-"));
const start = new Date("2026-11-19T06:00:00Z");
let minute = 0;
/** A clock one minute later on each call, so updates have an order. */
function nextClock(): Clock {
  minute += 1;
  return fixedClock(new Date(start.getTime() + minute * 60_000));
}
const storage = createFakePhotoStorage({ dir, signingKey: photoSigningKey("x".repeat(40)), clock: fixedClock(start) });
const deps = { storage, clock: fixedClock(start) };

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  minute = 0;
  await db.delete(bookingEvents);
  await db.delete(photoSets);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values(
    [asha, ravi, mona, mike, manu, omar].map(({ id, phoneNumber }) => ({
      id,
      name: id === "asha" ? "Asha" : id === "ravi" ? "Ravi" : "Staff",
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
    })),
  );
  logIn(mona);
});

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";
let codes = 0;

/** A booking of `userId`'s, assigned to `assigned`, at step `jobStatus`, with one line; returns its id. */
async function job({
  userId = "asha",
  assigned = "mona" as string | null,
  jobStatus = null as JobStatus | null,
  startsAt = new Date("2026-11-19T04:30:00.000Z"),
} = {}): Promise<string> {
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
      startsAt,
      isEstimate: true,
      requestToken: randomUUID(),
      jobStatus,
      assignedMechanicId: assigned,
    })
    .returning({ id: bookings.id });
  await db.insert(bookingEvents).values({ bookingId: row!.id, kind: "booked", actorUserId: userId });
  await db.insert(bookingItems).values({
    bookingId: row!.id,
    serviceId: "brakes",
    serviceKind: "service",
    name: { en: "Brakes" },
    priceStatus: "no-price",
    position: 0,
  });
  return row!.id;
}

function input(bookingId: string, changes: Partial<JobUpdateInput> = {}): JobUpdateInput {
  return { bookingId, toStatus: "", note: "", photoSetId: "", requestToken: randomUUID(), ...changes };
}

async function stepOf(bookingId: string): Promise<JobStatus | null> {
  const [row] = await db.select({ jobStatus: bookings.jobStatus }).from(bookings).where(eq(bookings.id, bookingId));
  return row!.jobStatus;
}

/** A job photo set with one stored photo, started and finished as whoever is logged in. */
async function jobPhotos(bookingId: string): Promise<string> {
  const started = await startJobPhotoUpload({ bookingId, count: 1 }, deps);
  if (!started.ok) throw new Error(started.problem);
  const [row] = await db.select({ key: photos.storageKey }).from(photos).where(eq(photos.id, started.uploads[0]!.photoId));
  const file = path.join(dir, row!.key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]));
  await finishJobPhotoUpload([started.uploads[0]!.photoId], deps);
  return started.setId;
}

describe("updateJob: who may update", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
  ])("%s: AccessDeniedError before the input check or the database", async (_, user) => {
    logIn(user);
    await expect(updateJob(input("not a uuid"), nextClock())).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a mechanic on another mechanic's job and on a missing one gets the same not-found, and nothing changes", async () => {
    const theirs = await job({ assigned: "mike" });
    for (const bookingId of [theirs, unknownId]) {
      expect(await updateJob(input(bookingId, { toStatus: "vehicle-received" }), nextClock())).toEqual({ status: "not-found" });
    }
    expect(await stepOf(theirs)).toBeNull();
    expect(await db.$count(bookingEvents, eq(bookingEvents.kind, "job-update"))).toBe(0);
  });

  test("an unassigned job: not-found for a mechanic, updated for a manager or the owner", async () => {
    const bookingId = await job({ assigned: null });
    expect((await updateJob(input(bookingId, { toStatus: "vehicle-received" }), nextClock())).status).toBe("not-found");
    logIn(manu);
    expect((await updateJob(input(bookingId, { toStatus: "vehicle-received" }), nextClock())).status).toBe("updated");
    logIn(omar);
    expect((await updateJob(input(bookingId, { toStatus: "inspection" }), nextClock())).status).toBe("updated");
  });
});

describe("updateJob: moves", () => {
  test("the assigned mechanic moves the job one step at a time; each move is one update", async () => {
    const bookingId = await job();
    for (const step of ["vehicle-received", "inspection", "in-service", "ready", "completed"] as const) {
      const result = await updateJob(input(bookingId, { toStatus: step }), nextClock());
      expect(result).toMatchObject({ status: "updated", update: { movedTo: step, note: null, hadPhotos: false } });
      expect(await stepOf(bookingId)).toBe(step);
    }
    expect(await db.$count(bookingEvents, eq(bookingEvents.kind, "job-update"))).toBe(5);
  });

  test("a move the table doesn't allow is refused and changes nothing", async () => {
    const bookingId = await job({ jobStatus: "vehicle-received" });
    expect(await updateJob(input(bookingId, { toStatus: "ready", note: "Done" }), nextClock())).toEqual({
      status: "problems",
      problems: [{ field: "status", problem: "move-not-allowed" }],
    });
    expect(await stepOf(bookingId)).toBe("vehicle-received");
    expect(await db.$count(bookingEvents, eq(bookingEvents.kind, "job-update"))).toBe(0);
  });

  test("nothing moves a job to awaiting approval by hand (task 33 sends estimates)", async () => {
    const bookingId = await job({ jobStatus: "inspection" });
    expect((await updateJob(input(bookingId, { toStatus: "awaiting-approval" }), nextClock())).status).toBe("problems");
  });

  test("a completed job: job-closed for a manager, not-found for the mechanic", async () => {
    const bookingId = await job({ jobStatus: "completed" });
    expect(await updateJob(input(bookingId, { note: "One more thing" }), nextClock())).toEqual({ status: "not-found" });
    logIn(manu);
    expect(await updateJob(input(bookingId, { note: "One more thing" }), nextClock())).toEqual({ status: "job-closed" });
  });

  test("a note-only update keeps the step", async () => {
    const bookingId = await job({ jobStatus: "inspection" });
    const result = await updateJob(input(bookingId, { note: "  Front pads worn\r\nDiscs fine " }), nextClock());
    expect(result).toMatchObject({ status: "updated", update: { movedTo: null, note: "Front pads worn\nDiscs fine" } });
    expect(await stepOf(bookingId)).toBe("inspection");
  });

  test("input problems come back before the database", async () => {
    const bookingId = await job();
    expect(await updateJob(input(bookingId), nextClock())).toEqual({
      status: "problems",
      problems: [{ field: "update", problem: "nothing-to-update" }],
    });
  });
});

describe("updateJob: a second send", () => {
  test("the same token again answers duplicate with the first update, although the step has moved since", async () => {
    const bookingId = await job();
    const send = input(bookingId, { toStatus: "vehicle-received", note: "Arrived" });
    const first = await updateJob(send, nextClock());
    if (first.status !== "updated") throw new Error(first.status);
    // The retry would now be "move-not-allowed" (vehicle-received → vehicle-received).
    expect(await updateJob(send, nextClock())).toEqual({ status: "duplicate", update: first.update });
    expect(await db.$count(bookingEvents, eq(bookingEvents.kind, "job-update"))).toBe(1);
  });

  test("a token first used on booking X, sent with booking Y, never answers with X's update", async () => {
    const x = await job();
    const y = await job();
    const token = randomUUID();
    const first = await updateJob(input(x, { note: "About X", requestToken: token }), nextClock());
    expect(first.status).toBe("updated");
    // The unique (actor, token) refuses the second write: a throw, never X's update.
    await expect(updateJob(input(y, { note: "About Y", requestToken: token }), nextClock())).rejects.toThrow();
    const [onY] = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, y));
    expect(onY!.kind).toBe("booked");
  });

  test("after the job is reassigned, the first mechanic's retry is not-found (they no longer see it)", async () => {
    const bookingId = await job();
    const send = input(bookingId, { toStatus: "vehicle-received" });
    expect((await updateJob(send, nextClock())).status).toBe("updated");
    await db.update(bookings).set({ assignedMechanicId: "mike" }).where(eq(bookings.id, bookingId));
    expect(await updateJob(send, nextClock())).toEqual({ status: "not-found" });
  });
});

describe("updateJob: photos", () => {
  test("an update with the job's set links it, marks had_photos and closes the set", async () => {
    const bookingId = await job({ jobStatus: "inspection" });
    const setId = await jobPhotos(bookingId);
    const otherSet = await jobPhotos(bookingId);
    const result = await updateJob(input(bookingId, { photoSetId: setId }), nextClock());
    expect(result).toMatchObject({ status: "updated", update: { hadPhotos: true } });
    const [set] = await db.select().from(photoSets).where(eq(photoSets.id, setId));
    expect(set!.closedAt).not.toBeNull();
    const [other] = await db.select().from(photoSets).where(eq(photoSets.id, otherSet));
    expect(other!.closedAt).toBeNull();
  });

  test("a used set, another job's set, a customer's own set and a missing set are photos-not-found", async () => {
    const bookingId = await job({ jobStatus: "inspection" });
    const otherJob = await job({ jobStatus: "inspection" });
    const used = await jobPhotos(bookingId);
    expect((await updateJob(input(bookingId, { photoSetId: used }), nextClock())).status).toBe("updated");
    const othersSet = await jobPhotos(otherJob);
    const [customerSet] = await db.insert(photoSets).values({ userId: "asha" }).returning({ id: photoSets.id });
    for (const setId of [used, othersSet, customerSet!.id, unknownId]) {
      expect(await updateJob(input(bookingId, { photoSetId: setId }), nextClock())).toEqual({
        status: "problems",
        problems: [{ field: "photos", problem: "photos-not-found" }],
      });
    }
  });
});

describe("readMyJobTimeline", () => {
  test("logged out: AccessDeniedError before the database", async () => {
    logIn(null);
    await expect(readMyJobTimeline(unknownId, deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the customer reads their job: updates oldest first, each with its step, no booked entry, no actor", async () => {
    const bookingId = await job();
    await updateJob(input(bookingId, { toStatus: "vehicle-received" }), nextClock());
    await updateJob(input(bookingId, { note: "Checking the brakes" }), nextClock());
    const setId = await jobPhotos(bookingId);
    await updateJob(input(bookingId, { toStatus: "inspection", photoSetId: setId }), nextClock());
    logIn(asha);
    const timeline = await readMyJobTimeline(bookingId, deps);
    expect(timeline).toMatchObject({
      bookingId,
      jobStatus: "inspection",
      vehicle: { kind: "car", makeName: { en: "Honda" }, modelName: { en: "City" }, fuel: "petrol", registrationNumber: "MH12AB1234" },
    });
    expect(timeline!.updates.map(({ movedTo, stepAfter, note }) => ({ movedTo, stepAfter, note }))).toEqual([
      { movedTo: "vehicle-received", stepAfter: "vehicle-received", note: null },
      { movedTo: null, stepAfter: "vehicle-received", note: "Checking the brakes" },
      { movedTo: "inspection", stepAfter: "inspection", note: null },
    ]);
    expect(timeline!.updates[2]!.photos).toHaveLength(1);
    expect(Object.keys(timeline!.updates[0]!)).not.toContain("actorUserId");
  });

  test("another customer's booking, a missing one and a malformed id are null", async () => {
    const bookingId = await job();
    logIn(ravi);
    for (const id of [bookingId, unknownId, "1; drop"]) expect(await readMyJobTimeline(id, deps)).toBeNull();
  });

  test("a job not started has no updates", async () => {
    const bookingId = await job();
    logIn(asha);
    expect(await readMyJobTimeline(bookingId, deps)).toMatchObject({ jobStatus: null, updates: [] });
  });
});

describe("readJob", () => {
  test("a customer: AccessDeniedError before the database", async () => {
    logIn(asha);
    await expect(readJob(unknownId, deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the assigned mechanic gets the job, its lines, updates and photos, but no phone number", async () => {
    const bookingId = await job();
    await updateJob(input(bookingId, { toStatus: "vehicle-received" }), nextClock());
    const setId = await jobPhotos(bookingId);
    await updateJob(input(bookingId, { note: "Pads", photoSetId: setId }), nextClock());
    const seen = await readJob(bookingId, deps);
    expect(seen).toMatchObject({ customerName: "Asha", phoneNumber: null, lines: [{ name: { en: "Brakes" } }], jobStatus: "vehicle-received" });
    expect(seen!.updates[1]).toMatchObject({ note: "Pads", stepAfter: "vehicle-received", movedTo: null });
    expect(seen!.updates[1]!.photos).toHaveLength(1);
  });

  test("a manager gets the phone number; another mechanic and a missing id get null", async () => {
    const bookingId = await job();
    logIn(manu);
    expect(await readJob(bookingId, deps)).toMatchObject({ phoneNumber: "+919876500001" });
    logIn(mike);
    expect(await readJob(bookingId, deps)).toBeNull();
    expect(await readJob(unknownId, deps)).toBeNull();
  });

  test("the mechanic loses the job once it's completed; the manager keeps it", async () => {
    const bookingId = await job({ jobStatus: "completed" });
    expect(await readJob(bookingId, deps)).toBeNull();
    logIn(manu);
    expect(await readJob(bookingId, deps)).not.toBeNull();
  });
});

describe("listMyAssignedJobs", () => {
  test("a customer: AccessDeniedError before the database", async () => {
    logIn(asha);
    await expect(listMyAssignedJobs()).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the mechanic's own unfinished jobs, soonest first; not other mechanics' or completed ones", async () => {
    const later = await job({ startsAt: new Date("2026-11-19T08:30:00.000Z"), jobStatus: "inspection" });
    const sooner = await job({ startsAt: new Date("2026-11-19T04:30:00.000Z") });
    await job({ jobStatus: "completed" });
    await job({ assigned: "mike" });
    await job({ assigned: null });
    const rows = await listMyAssignedJobs();
    expect(rows.map((row) => row.bookingId)).toEqual([sooner, later]);
    expect(rows[1]).toMatchObject({ jobStatus: "inspection", vehicle: { registrationNumber: "MH12AB1234" } });
  });
});
