// Customers' photos (task 30): starting and finishing uploads, view links,
// and deleting old photos.
//
// The rules of this folder are in garage.ts; the customer-data rules are the
// ones in customer-vehicles.ts:
// - no function takes the caller's user id: each calls authorizeUser() or
//   authorize(...) on its first line, before it checks its input or calls
//   getDatabase(), and works with the user it returns;
// - a customer works only on their own sets; anything else, and an id that
//   isn't a uuid, is "not found";
// - staff with "photos.view" (manager, owner) may see any set's photos. The
//   assigned mechanic's access comes with task 31's jobs.
//
// Photo files never pass through here: the browser uploads each one straight
// to storage with a signed link (startPhotoUpload), then this file checks
// what arrived (finishPhotoUpload). Storage calls happen outside database
// transactions: PGlite has one connection, and a transaction holds it.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { can } from "@/domain/permissions";
import { isUuid, looksLikeJpeg, PHOTO_CONTENT_TYPE, PHOTO_RULES, photoKey } from "@/domain/photos";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize, authorizeUser } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { photoSets, photos } from "@/server/db/schema";
import { photoStorage, type PhotoStorage, type UploadTarget } from "@/server/providers/photos";

/** What the browser needs to upload one photo. */
export type PhotoUpload = { photoId: string; target: UploadTarget };

export type StartPhotoUploadResult =
  | { ok: true; setId: string; uploads: PhotoUpload[] }
  | { ok: false; problem: "bad-count" | "too-many-photos" | "too-many-sets" | "not-found" };

export type PhotoDependencies = { storage?: PhotoStorage; clock?: Clock };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Files removed per storage call during cleanup. */
const REMOVE_BATCH = 100;

/**
 * Makes room for `count` new photos: in the caller's set `setId`, or in a new
 * set. Pending rows count toward the 6, so two uploads at once can't go over
 * it; the set's row is locked while counting. A customer who started 5 open
 * sets in the last 24 hours gets "too-many-sets", so one account can't fill
 * the storage. Old photos are cleaned up first (deleteOldPhotos). If storage
 * fails before any link is handed out, the new rows are taken back.
 */
export async function startPhotoUpload(
  request: { setId?: string; count: number },
  { storage = photoStorage(), clock = systemClock }: PhotoDependencies = {},
): Promise<StartPhotoUploadResult> {
  const user = await authorizeUser();
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > PHOTO_RULES.maxPerSet) {
    return { ok: false, problem: "bad-count" };
  }
  if (request.setId !== undefined && !isUuid(request.setId)) return { ok: false, problem: "not-found" };

  await deleteOldPhotos({ storage, clock });

  const now = clock.now();
  const db = await getDatabase();
  const planned = await db.transaction(async (tx) => {
    // One customer's uploads one at a time, so two can't both pass a limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`photos:${user.id}`}))`);

    let setId = request.setId;
    if (setId === undefined) {
      const [recent] = await tx
        .select({ value: count() })
        .from(photoSets)
        .where(
          and(eq(photoSets.userId, user.id), isNull(photoSets.closedAt), gt(photoSets.createdAt, new Date(now.getTime() - DAY_MS))),
        );
      if ((recent?.value ?? 0) >= PHOTO_RULES.maxNewSetsPerDay) return { ok: false as const, problem: "too-many-sets" as const };
      const [created] = await tx.insert(photoSets).values({ userId: user.id, createdAt: now }).returning({ id: photoSets.id });
      setId = created!.id;
    } else {
      // A set in its last day before cleanup takes no more photos: an upload
      // link handed out now (up to 2 hours) must never outlive the set, or
      // its file would land after the cleanup and never be deleted.
      const [own] = await tx
        .select({ id: photoSets.id })
        .from(photoSets)
        .where(
          and(
            eq(photoSets.id, setId),
            eq(photoSets.userId, user.id),
            isNull(photoSets.closedAt),
            gt(photoSets.createdAt, new Date(now.getTime() - PHOTO_RULES.keepOpenDays * DAY_MS + PHOTO_RULES.keepPendingHours * HOUR_MS)),
          ),
        )
        .for("update");
      if (!own) return { ok: false as const, problem: "not-found" as const };
      const [held] = await tx.select({ value: count() }).from(photos).where(eq(photos.setId, setId));
      if ((held?.value ?? 0) + request.count > PHOTO_RULES.maxPerSet) return { ok: false as const, problem: "too-many-photos" as const };
    }

    const rows = Array.from({ length: request.count }, () => {
      const id = randomUUID();
      return { id, setId: setId!, storageKey: photoKey(setId!, id), createdAt: now };
    });
    await tx.insert(photos).values(rows);
    return { ok: true as const, setId: setId!, created: request.setId === undefined, rows };
  });
  if (!planned.ok) return planned;

  try {
    const uploads = await Promise.all(
      planned.rows.map(async (row) => ({
        photoId: row.id,
        target: await storage.uploadTarget(row.storageKey, PHOTO_CONTENT_TYPE),
      })),
    );
    return { ok: true, setId: planned.setId, uploads };
  } catch (error) {
    // No link reached the browser, so no file can arrive: take the places
    // back (and the new set, which would count toward the daily limit).
    if (planned.created) await db.delete(photoSets).where(eq(photoSets.id, planned.setId));
    else await db.delete(photos).where(inArray(photos.id, planned.rows.map((row) => row.id)));
    throw error;
  }
}

/** One photo after finishPhotoUpload: stored, or still pending (it can be sent again). */
export type FinishedPhoto = { photoId: string; stored: boolean };

/**
 * Checks each of the caller's pending photos in storage: there, a JPEG (by
 * its first bytes), at most 2 MB. A good one becomes "stored".
 *
 * Anything else stays "pending", holding its place: a file that wasn't a
 * good JPEG is removed, and a missing one may still be on its way. Its
 * upload link keeps working for a while (10 minutes on the fake, 2 hours
 * on Supabase), so deleting the row now would let a late upload leave a
 * file that no row points to and no cleanup ever finds. The browser can
 * send it again through the same link and finish again; otherwise
 * deleteOldPhotos removes the row and any file after 24 hours.
 *
 * A storage error on one photo leaves it pending and goes on with the rest.
 * Ids that aren't the caller's pending photos come back as not stored.
 */
export async function finishPhotoUpload(
  photoIds: readonly string[],
  { storage = photoStorage(), clock = systemClock }: PhotoDependencies = {},
): Promise<FinishedPhoto[]> {
  const user = await authorizeUser();
  const ids = [...new Set(photoIds)].filter(isUuid);
  if (ids.length === 0) return photoIds.map((photoId) => ({ photoId, stored: false }));

  const db = await getDatabase();
  const mine = await db
    .select({ id: photos.id, storageKey: photos.storageKey })
    .from(photos)
    .innerJoin(photoSets, eq(photos.setId, photoSets.id))
    .where(and(inArray(photos.id, ids), eq(photoSets.userId, user.id), eq(photos.status, "pending")));

  const stored = new Set<string>();
  for (const photo of mine) {
    try {
      const file = await storage.inspect(photo.storageKey);
      if (file === null) continue;
      const good =
        file.bytes > 0 &&
        file.bytes <= PHOTO_RULES.maxBytes &&
        file.contentType === PHOTO_CONTENT_TYPE &&
        looksLikeJpeg(file.firstBytes);
      if (!good) {
        await storage.remove([photo.storageKey]);
        continue;
      }
      await db
        .update(photos)
        .set({ status: "stored", bytes: file.bytes, storedAt: clock.now() })
        .where(and(eq(photos.id, photo.id), eq(photos.status, "pending")));
      stored.add(photo.id);
    } catch (error) {
      // No key, no URL: only what failed. The photo stays pending.
      console.error(`Photo check skipped: ${error instanceof Error ? error.name : "error"}`);
    }
  }
  return photoIds.map((photoId) => ({ photoId, stored: stored.has(photoId) }));
}

export type PhotoViewResult = { ok: true; photos: { photoId: string; url: string }[] } | { ok: false; problem: "not-found" };

/**
 * Short-lived view links for a set's stored photos, oldest first: for the
 * set's customer, or staff with "photos.view". Everyone else gets
 * "not-found", the same answer as a set that doesn't exist.
 */
export async function photoViewUrls(
  setId: string,
  { storage = photoStorage() }: PhotoDependencies = {},
): Promise<PhotoViewResult> {
  const user = await authorizeUser();
  if (!isUuid(setId)) return { ok: false, problem: "not-found" };
  const db = await getDatabase();
  const [set] = await db.select({ userId: photoSets.userId }).from(photoSets).where(eq(photoSets.id, setId));
  if (!set || (set.userId !== user.id && !can(user.role, "photos.view"))) return { ok: false, problem: "not-found" };

  const rows = await db
    .select({ id: photos.id, storageKey: photos.storageKey })
    .from(photos)
    .where(and(eq(photos.setId, setId), eq(photos.status, "stored")))
    .orderBy(asc(photos.createdAt), asc(photos.id));
  return {
    ok: true,
    photos: await Promise.all(
      rows.map(async (row) => ({ photoId: row.id, url: await storage.viewUrl(row.storageKey, PHOTO_RULES.viewLinkSeconds) })),
    ),
  };
}

/**
 * Deletes, files first and then rows: sets closed more than a year ago,
 * sets never closed that were started more than 30 days ago, and uploads
 * not finished within 24 hours. Runs at the start of every startPhotoUpload:
 * there's no timer yet, and the privacy notice says so. If storage fails,
 * the cleanup stops quietly and the rows stay, so the next upload tries
 * again; the customer's upload goes on.
 */
export async function deleteOldPhotos({ storage = photoStorage(), clock = systemClock }: PhotoDependencies = {}): Promise<void> {
  // Any logged-in customer's upload runs this cleanup for everyone; nobody
  // logged out can.
  await authorizeUser();
  const now = clock.now().getTime();
  const db = await getDatabase();
  const oldSets = await db
    .select({ id: photoSets.id })
    .from(photoSets)
    .where(
      or(
        and(isNotNull(photoSets.closedAt), lt(photoSets.closedAt, new Date(now - PHOTO_RULES.keepClosedDays * DAY_MS))),
        and(isNull(photoSets.closedAt), lt(photoSets.createdAt, new Date(now - PHOTO_RULES.keepOpenDays * DAY_MS))),
      ),
    );
  const setIds = oldSets.map((set) => set.id);
  const inOldSets = setIds.length > 0 ? await db.select({ key: photos.storageKey }).from(photos).where(inArray(photos.setId, setIds)) : [];
  const stale = await db
    .select({ id: photos.id, key: photos.storageKey })
    .from(photos)
    .where(and(eq(photos.status, "pending"), lt(photos.createdAt, new Date(now - PHOTO_RULES.keepPendingHours * HOUR_MS))));

  const keys = [...inOldSets.map((row) => row.key), ...stale.map((row) => row.key)];
  if (keys.length === 0 && setIds.length === 0) return;
  try {
    // In batches, so one huge request never stalls every cleanup.
    for (let start = 0; start < keys.length; start += REMOVE_BATCH) {
      await storage.remove(keys.slice(start, start + REMOVE_BATCH));
    }
  } catch (error) {
    // No key, no URL: only what failed.
    console.error(`Photo cleanup skipped: ${error instanceof Error ? error.name : "error"}`);
    return;
  }
  if (setIds.length > 0) await db.delete(photoSets).where(inArray(photoSets.id, setIds));
  const staleIds = stale.map((row) => row.id);
  if (staleIds.length > 0) await db.delete(photos).where(inArray(photos.id, staleIds));
}

/**
 * Deletes every photo of one customer, files first and then rows, for when
 * their data is deleted (task 43). The owner's alone ("customers.delete").
 * Deleting the user afterwards would remove the rows anyway ("cascade"), but
 * not the files: this must run first.
 */
export async function deletePhotosOfUser(
  userId: string,
  { storage = photoStorage() }: PhotoDependencies = {},
): Promise<void> {
  await authorize("customers.delete");
  const db = await getDatabase();
  const rows = await db
    .select({ key: photos.storageKey })
    .from(photos)
    .innerJoin(photoSets, eq(photos.setId, photoSets.id))
    .where(eq(photoSets.userId, userId));
  await storage.remove(rows.map((row) => row.key));
  await db.delete(photoSets).where(eq(photoSets.userId, userId));
}
