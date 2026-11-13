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
import { photoSets, photos, users } from "@/server/db/schema";
import { createFakePhotoStorage } from "@/server/providers/photos/fake";
import { photoSigningKey } from "@/server/providers/photos/token";
import type { PhotoStorage } from "@/server/providers/photos/types";

import { deleteOldPhotos, deletePhotosOfUser, finishPhotoUpload, photoViewUrls, startPhotoUpload } from "./photos";

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

  test("a failed upload frees its place: a retry into the same set is accepted", async () => {
    const first = await startPhotoUpload({ count: 6 }, deps);
    if (!first.ok) throw new Error(first.problem);
    // Only five PUTs arrived.
    for (const upload of first.uploads.slice(0, 5)) await putFile(upload.photoId);
    await finishPhotoUpload(
      first.uploads.map((upload) => upload.photoId),
      deps,
    );
    expect((await startPhotoUpload({ setId: first.setId, count: 1 }, deps)).ok).toBe(true);
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
    expect(await db.select().from(photos).where(eq(photos.id, fake))).toHaveLength(0);
    expect(await storage.inspect(photoKeyOf(started.setId, fake))).toBeNull();
  });

  test("a photo that never arrived is deleted", async () => {
    const started = await startPhotoUpload({ count: 1 }, deps);
    if (!started.ok) throw new Error(started.problem);
    expect(await finishPhotoUpload([started.uploads[0]!.photoId], deps)).toEqual([{ photoId: started.uploads[0]!.photoId, stored: false }]);
    expect(await db.select().from(photos)).toHaveLength(0);
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
