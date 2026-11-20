import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { PHOTO_RULES } from "@/domain/photos";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookings, photoSets, photos, users } from "@/server/db/schema";
import { createFakePhotoStorage } from "@/server/providers/photos/fake";
import { photoSigningKey } from "@/server/providers/photos/token";
import type { PhotoStorage } from "@/server/providers/photos/types";

import {
  deleteOldPhotos,
  deletePhotosOfUser,
  finishJobPhotoUpload,
  finishPhotoUpload,
  photoViewUrls,
  startJobPhotoUpload,
  startPhotoUpload,
} from "./photos";

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
const mechanic: TestUser = { id: "mech", phoneNumber: "+919876500003", role: "mechanic" };
const manager: TestUser = { id: "mgr", phoneNumber: "+919876500004", role: "manager" };
const owner: TestUser = { id: "own", phoneNumber: "+919876500005", role: "owner" };

function logIn(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

const dir = mkdtempSync(path.join(os.tmpdir(), "gomechanic-photo-dal-"));
const now = new Date("2026-11-13T06:00:00Z");
const clock = fixedClock(now);
const storage = createFakePhotoStorage({ dir, signingKey: photoSigningKey("x".repeat(40)), clock });
const deps = { storage, clock };
const DAY = 24 * 60 * 60 * 1000;

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/** Puts `bytes` where the photo's upload would land (as a PUT would). */
async function putFile(photoId: string, bytes: Buffer = jpeg) {
  const [row] = await db.select({ key: photos.storageKey }).from(photos).where(eq(photos.id, photoId));
  const file = path.join(dir, row!.key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

/** Starts and finishes `count` good photos as Asha; returns the set id. */
async function storedSet(count = 1): Promise<string> {
  const started = await startPhotoUpload({ count }, deps);
  if (!started.ok) throw new Error(started.problem);
  for (const upload of started.uploads) await putFile(upload.photoId);
  await finishPhotoUpload(
    started.uploads.map((upload) => upload.photoId),
    deps,
  );
  return started.setId;
}

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
  logIn(asha);
  await db.delete(photoSets);
  await db.delete(bookings);
  await db.delete(users);
  await db.insert(users).values(
    [asha, ravi, mechanic, manager, owner].map(({ id, phoneNumber }) => ({
      id,
      name: "",
      email: `${phoneNumber.slice(1)}@phone.invalid`,
      phoneNumber,
    })),
  );
});

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";

describe("startPhotoUpload", () => {
  test("logged out: AccessDeniedError before the database is touched", async () => {
    logIn(null);
    await expect(startPhotoUpload({ count: 1 }, deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("makes a set and one pending row and upload link per photo", async () => {
    const started = await startPhotoUpload({ count: 3 }, deps);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.uploads).toHaveLength(3);
    expect(started.uploads[0]!.target).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/jpeg" } });
    const rows = await db.select().from(photos).where(eq(photos.setId, started.setId));
    expect(rows.map((row) => row.status)).toEqual(["pending", "pending", "pending"]);
    const [set] = await db.select().from(photoSets).where(eq(photoSets.id, started.setId));
    expect(set!.userId).toBe("asha");
  });

  test("refuses 0, 7 or a fraction (bad-count)", async () => {
    for (const count of [0, 7, 1.5]) {
      expect(await startPhotoUpload({ count }, deps)).toEqual({ ok: false, problem: "bad-count" });
    }
  });

  test("a 7th photo is refused, also across two calls, pending ones included", async () => {
    const first = await startPhotoUpload({ count: 4 }, deps);
    if (!first.ok) throw new Error(first.problem);
    expect(await startPhotoUpload({ setId: first.setId, count: 3 }, deps)).toEqual({ ok: false, problem: "too-many-photos" });
    expect((await startPhotoUpload({ setId: first.setId, count: 2 }, deps)).ok).toBe(true);
  });

  test("a photo that hasn't arrived keeps its place: it is sent again through its own link, not a new one", async () => {
    const first = await startPhotoUpload({ count: 6 }, deps);
    if (!first.ok) throw new Error(first.problem);
    // Only five PUTs arrived.
    for (const upload of first.uploads.slice(0, 5)) await putFile(upload.photoId);
    const ids = first.uploads.map((upload) => upload.photoId);
    expect((await finishPhotoUpload(ids, deps)).filter((photo) => photo.stored)).toHaveLength(5);
    // Finishing early frees nothing, so nobody can go past 6.
    expect(await startPhotoUpload({ setId: first.setId, count: 1 }, deps)).toEqual({ ok: false, problem: "too-many-photos" });
    // The sixth arrives late, through the same link, and is tracked.
    await putFile(ids[5]!);
    expect(await finishPhotoUpload([ids[5]!], deps)).toEqual([{ photoId: ids[5], stored: true }]);
  });

  test("a storage failure before any link is handed out takes the new set back", async () => {
    const failing: PhotoStorage = { ...storage, uploadTarget: () => Promise.reject(new Error("storage down")) };
    await expect(startPhotoUpload({ count: 2 }, { storage: failing, clock })).rejects.toThrow("storage down");
    expect(await db.select().from(photoSets)).toHaveLength(0);

    const setId = await storedSet();
    await expect(startPhotoUpload({ setId, count: 2 }, { storage: failing, clock })).rejects.toThrow("storage down");
    expect(await db.select().from(photos).where(eq(photos.setId, setId))).toHaveLength(1);
  });

  test("logged out with a bad count: AccessDeniedError, not bad-count, and no database", async () => {
    logIn(null);
    await expect(startPhotoUpload({ count: 0 }, deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a 6th open set within 24 hours is too-many-sets", async () => {
    for (let i = 0; i < PHOTO_RULES.maxNewSetsPerDay; i++) expect((await startPhotoUpload({ count: 1 }, deps)).ok).toBe(true);
    expect(await startPhotoUpload({ count: 1 }, deps)).toEqual({ ok: false, problem: "too-many-sets" });
    logIn(ravi);
    expect((await startPhotoUpload({ count: 1 }, deps)).ok).toBe(true);
  });

  test("another customer's set, a missing one and a malformed id are not-found", async () => {
    const setId = await storedSet();
    logIn(ravi);
    expect(await startPhotoUpload({ setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
    expect(await startPhotoUpload({ setId: unknownId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
    expect(await startPhotoUpload({ setId: "1 or 1=1", count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("a set in its last day before cleanup takes no more photos; a day earlier it does", async () => {
    const setId = await storedSet();
    await db.update(photoSets).set({ createdAt: new Date(now.getTime() - 28.5 * DAY) }).where(eq(photoSets.id, setId));
    expect((await startPhotoUpload({ setId, count: 1 }, deps)).ok).toBe(true);
    await db.update(photoSets).set({ createdAt: new Date(now.getTime() - 29.5 * DAY) }).where(eq(photoSets.id, setId));
    expect(await startPhotoUpload({ setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("a closed set takes no more photos", async () => {
    const setId = await storedSet();
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, setId));
    expect(await startPhotoUpload({ setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("a storage failure during cleanup doesn't stop the upload", async () => {
    const setId = await storedSet();
    await db.update(photoSets).set({ createdAt: new Date(now.getTime() - 31 * DAY) }).where(eq(photoSets.id, setId));
    const failing: PhotoStorage = {
      ...storage,
      remove: () => Promise.reject(new Error("storage down")),
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await startPhotoUpload({ count: 1 }, { storage: failing, clock })).ok).toBe(true);
    expect(quiet).toHaveBeenCalledWith("Photo cleanup skipped: Error");
    quiet.mockRestore();
    // The old set's rows stay, so the next cleanup tries again.
    expect(await db.select().from(photoSets).where(eq(photoSets.id, setId))).toHaveLength(1);
  });
});

describe("finishPhotoUpload", () => {
  test("logged out: AccessDeniedError before the database is touched, even for ids that aren't uuids", async () => {
    logIn(null);
    await expect(finishPhotoUpload(["nope"], deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("marks a photo stored only after storage shows a JPEG", async () => {
    const started = await startPhotoUpload({ count: 2 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const [good, fake] = started.uploads.map((upload) => upload.photoId) as [string, string];
    await putFile(good);
    await putFile(fake, Buffer.from("<svg>not a photo</svg>"));
    expect(await finishPhotoUpload([good, fake], deps)).toEqual([
      { photoId: good, stored: true },
      { photoId: fake, stored: false },
    ]);
    const [row] = await db.select().from(photos).where(eq(photos.id, good));
    expect(row).toMatchObject({ status: "stored", bytes: jpeg.byteLength, storedAt: now });
    // The bad file is removed; its row stays pending, so a second try is tracked too.
    const [left] = await db.select().from(photos).where(eq(photos.id, fake));
    expect(left!.status).toBe("pending");
    expect(await storage.inspect(photoKeyOf(started.setId, fake))).toBeNull();
  });

  test("a photo that never arrived stays pending", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    expect(await finishPhotoUpload([started.uploads[0]!.photoId], deps)).toEqual([{ photoId: started.uploads[0]!.photoId, stored: false }]);
    expect((await db.select().from(photos)).map((row) => row.status)).toEqual(["pending"]);
  });

  test("refuses a file over 2 MB, an empty one, or one that isn't a JPEG", async () => {
    const started = await startPhotoUpload({ count: 3 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const answers = [
      { bytes: PHOTO_RULES.maxBytes + 1, contentType: "image/jpeg", firstBytes: new Uint8Array([0xff, 0xd8, 0xff]) },
      { bytes: 0, contentType: "image/jpeg", firstBytes: new Uint8Array([0xff, 0xd8, 0xff]) },
      { bytes: 100, contentType: "image/png", firstBytes: new Uint8Array([0xff, 0xd8, 0xff]) },
    ];
    let n = 0;
    const remove = vi.fn<PhotoStorage["remove"]>().mockResolvedValue();
    const stub: PhotoStorage = { ...storage, inspect: async () => answers[n++]!, remove };
    const ids = started.uploads.map((upload) => upload.photoId);
    expect((await finishPhotoUpload(ids, { storage: stub, clock })).map((photo) => photo.stored)).toEqual([false, false, false]);
    expect(remove).toHaveBeenCalledTimes(3);
  });

  test("a storage error on one photo leaves it pending and still stores the others", async () => {
    const started = await startPhotoUpload({ count: 2 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const [first, second] = started.uploads.map((upload) => upload.photoId) as [string, string];
    await putFile(first);
    await putFile(second);
    let calls = 0;
    const flaky: PhotoStorage = {
      ...storage,
      inspect: (key) => (calls++ === 0 ? Promise.reject(new Error("storage down")) : storage.inspect(key)),
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await finishPhotoUpload([first, second], { storage: flaky, clock });
    quiet.mockRestore();
    expect(result.filter((photo) => photo.stored)).toHaveLength(1);
    expect((await db.select().from(photos)).map((row) => row.status).sort()).toEqual(["pending", "stored"]);
  });

  test("another customer can't finish (or delete) Asha's photo", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const photoId = started.uploads[0]!.photoId;
    logIn(ravi);
    expect(await finishPhotoUpload([photoId, "not-a-uuid"], deps)).toEqual([
      { photoId, stored: false },
      { photoId: "not-a-uuid", stored: false },
    ]);
    expect(await db.select().from(photos).where(eq(photos.id, photoId))).toHaveLength(1);
  });
});

/** The storage key, built the same way the data-access layer does. */
function photoKeyOf(setId: string, photoId: string) {
  return `sets/${setId}/${photoId}.jpg`;
}

describe("photoViewUrls", () => {
  test("logged out: AccessDeniedError before the database is touched", async () => {
    logIn(null);
    await expect(photoViewUrls("nope", deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the customer and a manager or the owner get links; a mechanic and another customer don't", async () => {
    const setId = await storedSet(2);
    for (const user of [asha, manager, owner]) {
      logIn(user);
      const result = await photoViewUrls(setId, deps);
      expect(result.ok && result.photos.map((photo) => photo.url.startsWith("/api/photos/view?t="))).toEqual([true, true]);
    }
    for (const user of [ravi, mechanic]) {
      logIn(user);
      expect(await photoViewUrls(setId, deps)).toEqual({ ok: false, problem: "not-found" });
    }
  });

  test("pending photos get no link; a malformed or missing id is not-found", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    expect(await photoViewUrls(started.setId, deps)).toEqual({ ok: true, photos: [] });
    expect(await photoViewUrls("nope", deps)).toEqual({ ok: false, problem: "not-found" });
    expect(await photoViewUrls(unknownId, deps)).toEqual({ ok: false, problem: "not-found" });
  });
});

describe("deleteOldPhotos", () => {
  async function aged(changes: { createdAt?: number; closedAt?: number }) {
    const setId = await storedSet();
    await db
      .update(photoSets)
      .set({
        createdAt: new Date(now.getTime() - (changes.createdAt ?? 0) * DAY),
        closedAt: changes.closedAt === undefined ? null : new Date(now.getTime() - changes.closedAt * DAY),
      })
      .where(eq(photoSets.id, setId));
    return setId;
  }
  const exists = async (setId: string) => (await db.select().from(photoSets).where(eq(photoSets.id, setId))).length === 1;

  test("keeps a set closed 364 days ago, deletes one closed 366 days ago, files included", async () => {
    const kept = await aged({ createdAt: 400, closedAt: 364 });
    const gone = await aged({ createdAt: 400, closedAt: 366 });
    const [goneKey] = await db.select({ key: photos.storageKey }).from(photos).where(eq(photos.setId, gone));
    await deleteOldPhotos(deps);
    expect(await exists(kept)).toBe(true);
    expect(await exists(gone)).toBe(false);
    expect(await storage.inspect(goneKey!.key)).toBeNull();
  });

  test("logged out: AccessDeniedError before the database is touched", async () => {
    logIn(null);
    await expect(deleteOldPhotos(deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a stored photo older than 24 hours is kept: only unfinished uploads go after a day", async () => {
    const setId = await storedSet();
    await db.update(photos).set({ createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) }).where(eq(photos.setId, setId));
    const [row] = await db.select({ key: photos.storageKey }).from(photos).where(eq(photos.setId, setId));
    await deleteOldPhotos(deps);
    expect(await db.select().from(photos).where(eq(photos.setId, setId))).toHaveLength(1);
    expect(await storage.inspect(row!.key)).not.toBeNull();
  });

  test("a late upload to a photo finished early is still deleted with its row after 24 hours", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const photoId = started.uploads[0]!.photoId;
    await finishPhotoUpload([photoId], deps);
    await putFile(photoId);
    const key = photoKeyOf(started.setId, photoId);
    await db.update(photos).set({ createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) }).where(eq(photos.id, photoId));
    await deleteOldPhotos(deps);
    expect(await db.select().from(photos)).toHaveLength(0);
    expect(await storage.inspect(key)).toBeNull();
  });

  test("keeps an open set started 29 days ago, deletes one started 31 days ago", async () => {
    const kept = await aged({ createdAt: 29 });
    const gone = await aged({ createdAt: 31 });
    await deleteOldPhotos(deps);
    expect(await exists(kept)).toBe(true);
    expect(await exists(gone)).toBe(false);
  });

  test("deletes an upload not finished within 24 hours, keeps a newer one", async () => {
    const started = await startPhotoUpload({ count: 2 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const [old, fresh] = started.uploads.map((upload) => upload.photoId) as [string, string];
    await db.update(photos).set({ createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) }).where(eq(photos.id, old));
    await deleteOldPhotos(deps);
    const left = await db.select({ id: photos.id }).from(photos);
    expect(left.map((row) => row.id)).toEqual([fresh]);
  });
});

describe("deletePhotosOfUser", () => {
  test("a customer, a mechanic and a manager get AccessDeniedError before the database is touched", async () => {
    for (const user of [asha, mechanic, manager]) {
      logIn(user);
      await expect(deletePhotosOfUser("asha", deps)).rejects.toThrow(AccessDeniedError);
    }
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the owner deletes one customer's sets and files, and no one else's", async () => {
    const ashaSet = await storedSet();
    const [ashaKey] = await db.select({ key: photos.storageKey }).from(photos).where(eq(photos.setId, ashaSet));
    logIn(ravi);
    const raviSet = await storedSet();
    logIn(owner);
    await deletePhotosOfUser("asha", deps);
    expect(await db.select().from(photoSets).where(eq(photoSets.userId, "asha"))).toHaveLength(0);
    expect(await storage.inspect(ashaKey!.key)).toBeNull();
    expect(await db.select().from(photoSets).where(eq(photoSets.id, raviSet))).toHaveLength(1);
  });
});

// --- Job photos (task 31) ----------------------------------------------------

const mechanic2: TestUser = { id: "mech2", phoneNumber: "+919876500006", role: "mechanic" };

/** A booking of Asha's, assigned to `assigned`, at step `jobStatus`; returns its id. */
async function job({ assigned = "mech" as string | null, jobStatus = "inspection" as typeof bookings.$inferInsert.jobStatus, code = "K7Q4MX" } = {}) {
  if (assigned === "mech2") {
    await db.insert(users).values({ id: "mech2", name: "", email: "919876500006@phone.invalid", phoneNumber: mechanic2.phoneNumber }).onConflictDoNothing();
  }
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
      startsAt: new Date("2026-11-13T04:30:00.000Z"),
      isEstimate: true,
      requestToken: randomUUID(),
      jobStatus,
      assignedMechanicId: assigned,
    })
    .returning({ id: bookings.id });
  return row!.id;
}

/** Starts and finishes `count` good photos of job `bookingId` as whoever is logged in; returns the set id. */
async function storedJobSet(bookingId: string, count = 1): Promise<string> {
  const started = await startJobPhotoUpload({ bookingId, count }, deps);
  if (!started.ok) throw new Error(started.problem);
  for (const upload of started.uploads) await putFile(upload.photoId);
  const finished = await finishJobPhotoUpload(
    started.uploads.map((upload) => upload.photoId),
    deps,
  );
  if (!finished.every((photo) => photo.stored)) throw new Error("not stored");
  return started.setId;
}

describe("startJobPhotoUpload", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
  ])("%s: AccessDeniedError before the database is touched", async (_, user) => {
    logIn(user);
    await expect(startJobPhotoUpload({ bookingId: unknownId, count: 1 }, deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("the assigned mechanic gets a set owned by the booking's customer and the job", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const started = await startJobPhotoUpload({ bookingId, count: 2 }, deps);
    if (!started.ok) throw new Error(started.problem);
    expect(started.uploads).toHaveLength(2);
    const [set] = await db.select().from(photoSets).where(eq(photoSets.id, started.setId));
    expect(set).toMatchObject({ userId: "asha", bookingId, closedAt: null });
  });

  test("another mechanic's job, a missing booking and a malformed id are all not-found", async () => {
    const bookingId = await job({ assigned: "mech2" });
    logIn(mechanic);
    for (const id of [bookingId, unknownId, "1; drop"]) {
      expect(await startJobPhotoUpload({ bookingId: id, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
    }
  });

  test("a manager adds photos to any job, assigned or not", async () => {
    const bookingId = await job({ assigned: null });
    logIn(manager);
    expect((await startJobPhotoUpload({ bookingId, count: 1 }, deps)).ok).toBe(true);
  });

  test("a completed job: job-closed for a manager, not-found for the assigned mechanic", async () => {
    const bookingId = await job({ jobStatus: "completed" });
    logIn(manager);
    expect(await startJobPhotoUpload({ bookingId, count: 1 }, deps)).toEqual({ ok: false, problem: "job-closed" });
    logIn(mechanic);
    expect(await startJobPhotoUpload({ bookingId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("a no-show booking: booking-closed for a manager, not-found for the assigned mechanic", async () => {
    const bookingId = await job();
    await db.update(bookings).set({ status: "no-show" }).where(eq(bookings.id, bookingId));
    logIn(manager);
    expect(await startJobPhotoUpload({ bookingId, count: 1 }, deps)).toEqual({ ok: false, problem: "booking-closed" });
    logIn(mechanic);
    expect(await startJobPhotoUpload({ bookingId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("adding to a set: only that job's open set, and never past 6", async () => {
    const bookingId = await job();
    const otherJob = await job({ code: "K7Q4MY" });
    logIn(mechanic);
    const first = await startJobPhotoUpload({ bookingId, count: 4 }, deps);
    if (!first.ok) throw new Error(first.problem);
    expect(await startJobPhotoUpload({ bookingId, setId: first.setId, count: 3 }, deps)).toEqual({ ok: false, problem: "too-many-photos" });
    expect((await startJobPhotoUpload({ bookingId, setId: first.setId, count: 2 }, deps)).ok).toBe(true);
    expect(await startJobPhotoUpload({ bookingId: otherJob, setId: first.setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, first.setId));
    const second = await startJobPhotoUpload({ bookingId, count: 1 }, deps);
    if (!second.ok) throw new Error(second.problem);
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, second.setId));
    expect(await startJobPhotoUpload({ bookingId, setId: second.setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
  });

  test("job sets don't count toward the customer's 5 new sets a day", async () => {
    const bookingId = await job();
    logIn(mechanic);
    for (let i = 0; i < PHOTO_RULES.maxNewSetsPerDay; i += 1) expect((await startJobPhotoUpload({ bookingId, count: 1 }, deps)).ok).toBe(true);
    logIn(asha);
    expect((await startPhotoUpload({ count: 1 }, deps)).ok).toBe(true);
  });
});

describe("the customer and job sets", () => {
  test("a customer can't add to or finish photos in a job set of their own booking", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const started = await startJobPhotoUpload({ bookingId, count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    await putFile(started.uploads[0]!.photoId);
    logIn(asha);
    expect(await startPhotoUpload({ setId: started.setId, count: 1 }, deps)).toEqual({ ok: false, problem: "not-found" });
    expect(await finishPhotoUpload([started.uploads[0]!.photoId], deps)).toEqual([{ photoId: started.uploads[0]!.photoId, stored: false }]);
  });
});

describe("finishJobPhotoUpload", () => {
  test("a customer: AccessDeniedError before the database is touched", async () => {
    logIn(asha);
    await expect(finishJobPhotoUpload([unknownId], deps)).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("stores the assigned mechanic's photos; another mechanic's finish stores nothing", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const started = await startJobPhotoUpload({ bookingId, count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const photoId = started.uploads[0]!.photoId;
    await putFile(photoId);
    logIn(mechanic2);
    expect(await finishJobPhotoUpload([photoId], deps)).toEqual([{ photoId, stored: false }]);
    logIn(mechanic);
    expect(await finishJobPhotoUpload([photoId], deps)).toEqual([{ photoId, stored: true }]);
  });

  test("an upload started before the booking became a no-show isn't stored, for the mechanic or a manager", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const started = await startJobPhotoUpload({ bookingId, count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    const photoId = started.uploads[0]!.photoId;
    await putFile(photoId);
    await db.update(bookings).set({ status: "no-show" }).where(eq(bookings.id, bookingId));
    expect(await finishJobPhotoUpload([photoId], deps)).toEqual([{ photoId, stored: false }]);
    logIn(manager);
    expect(await finishJobPhotoUpload([photoId], deps)).toEqual([{ photoId, stored: false }]);
  });

  test("a customer's own set can't be finished through the job function", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    await putFile(started.uploads[0]!.photoId);
    logIn(manager);
    expect(await finishJobPhotoUpload([started.uploads[0]!.photoId], deps)).toEqual([{ photoId: started.uploads[0]!.photoId, stored: false }]);
  });
});

describe("photoViewUrls for job sets", () => {
  test("the customer sees a job set only once an update holds it (closed); staff see it before", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const setId = await storedJobSet(bookingId);
    logIn(asha);
    expect(await photoViewUrls(setId, deps)).toEqual({ ok: false, problem: "not-found" });
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, setId));
    expect((await photoViewUrls(setId, deps)).ok).toBe(true);
  });

  test("the customer, the assigned mechanic and a manager see them; another mechanic doesn't", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const setId = await storedJobSet(bookingId);
    // Held by an update, as the customer sees it.
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, setId));
    for (const user of [asha, mechanic, manager, owner]) {
      logIn(user);
      const view = await photoViewUrls(setId, deps);
      expect(view.ok && view.photos).toHaveLength(1);
    }
    for (const user of [mechanic2, ravi]) {
      logIn(user);
      expect(await photoViewUrls(setId, deps)).toEqual({ ok: false, problem: "not-found" });
    }
  });

  test("the mechanic loses access when the job is reassigned or completed", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const setId = await storedJobSet(bookingId);
    await db.insert(users).values({ id: "mech2", name: "", email: "919876500006@phone.invalid", phoneNumber: mechanic2.phoneNumber });
    await db.update(bookings).set({ assignedMechanicId: "mech2" }).where(eq(bookings.id, bookingId));
    expect(await photoViewUrls(setId, deps)).toEqual({ ok: false, problem: "not-found" });
    logIn(mechanic2);
    expect((await photoViewUrls(setId, deps)).ok).toBe(true);
    await db.update(bookings).set({ jobStatus: "completed" }).where(eq(bookings.id, bookingId));
    expect(await photoViewUrls(setId, deps)).toEqual({ ok: false, problem: "not-found" });
    await db.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, setId));
    logIn(asha);
    expect((await photoViewUrls(setId, deps)).ok).toBe(true);
  });
});

describe("cleanup and deletion of job sets", () => {
  test("deleteOldPhotos removes an expired job set that an update points to; the update stays", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const setId = await storedJobSet(bookingId);
    await db.update(photoSets).set({ closedAt: new Date(now.getTime() - (PHOTO_RULES.keepClosedDays + 1) * DAY) }).where(eq(photoSets.id, setId));
    await db.insert(bookingEvents).values({ bookingId, kind: "job-update", actorUserId: "mech", photoSetId: setId, hadPhotos: true, requestToken: randomUUID() });
    await deleteOldPhotos(deps);
    expect(await db.$count(photoSets, eq(photoSets.id, setId))).toBe(0);
    const [event] = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId));
    expect(event).toMatchObject({ photoSetId: null, hadPhotos: true });
  });

  test("deletePhotosOfUser removes the customer's job photos too", async () => {
    const bookingId = await job();
    logIn(mechanic);
    const setId = await storedJobSet(bookingId);
    logIn(owner);
    await deletePhotosOfUser("asha", deps);
    expect(await db.$count(photoSets, eq(photoSets.id, setId))).toBe(0);
  });
});
