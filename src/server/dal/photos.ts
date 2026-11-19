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
// - staff with "photos.view" (manager, owner) may see any set's photos;
// - a job's photos (task 31) are added by staff who may work on the job
//   (job-access.ts), and the assigned mechanic may see them.
//
// Photo files never pass through here: the browser uploads each one straight
// to storage with a signed link (startPhotoUpload), then this file checks
// what arrived (finishPhotoUpload). Storage calls happen outside database
// transactions: PGlite has one connection, and a transaction holds it.

import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, or, type SQL, sql } from "drizzle-orm";

import { can } from "@/domain/permissions";
import { isUuid, looksLikeJpeg, PHOTO_CONTENT_TYPE, PHOTO_RULES, photoKey } from "@/domain/photos";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize, authorizeUser } from "@/server/auth/access";
import type { CurrentUser } from "@/server/auth/session";
import { type Database, getDatabase } from "@/server/db";
import { bookings, photoSets, photos } from "@/server/db/schema";
import { jobRowFilter, jobsOf } from "@/server/dal/job-access";
import type { SlotTransaction } from "@/server/dal/slots";
import { photoStorage, type PhotoStorage, type UploadTarget } from "@/server/providers/photos";

/** What the browser needs to upload one photo. */
export type PhotoUpload = { photoId: string; target: UploadTarget };

export type StartPhotoUploadResult =
  | { ok: true; setId: string; uploads: PhotoUpload[] }
  | { ok: false; problem: "bad-count" | "too-many-photos" | "too-many-sets" | "not-found" };

export type StartJobPhotoUploadResult =
  | { ok: true; setId: string; uploads: PhotoUpload[] }
  | { ok: false; problem: "bad-count" | "too-many-photos" | "not-found" | "job-closed" };

export type PhotoDependencies = { storage?: PhotoStorage; clock?: Clock };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Files removed per storage call during cleanup. */
const REMOVE_BATCH = 100;

type Transaction = SlotTransaction;
type PlannedRow = { id: string; setId: string; storageKey: string; createdAt: Date };
type Planned = { ok: true; setId: string; created: boolean; rows: PlannedRow[] };

/**
 * An existing set that may take more photos, locked: still open, and not in
 * its last day before cleanup. An upload link handed out now (up to 2 hours)
 * must never outlive the set, or its file would land after the cleanup and
 * never be deleted.
 */
async function lockOpenSet(tx: Transaction, where: SQL, now: Date): Promise<boolean> {
  const [open] = await tx
    .select({ id: photoSets.id })
    .from(photoSets)
    .where(
      and(
        where,
        isNull(photoSets.closedAt),
        gt(photoSets.createdAt, new Date(now.getTime() - PHOTO_RULES.keepOpenDays * DAY_MS + PHOTO_RULES.keepPendingHours * HOUR_MS)),
      ),
    )
    .for("update");
  return open !== undefined;
}

/** Room for `count` more photos in `setId`? Pending rows count toward the 6. */
async function hasRoom(tx: Transaction, setId: string, count: number): Promise<boolean> {
  const [held] = await tx.select({ value: sql<number>`count(*)::int` }).from(photos).where(eq(photos.setId, setId));
  return (held?.value ?? 0) + count <= PHOTO_RULES.maxPerSet;
}

/** The pending rows for `count` new photos in `setId`, written in the caller's transaction. */
async function addPendingPhotos(tx: Transaction, setId: string, count: number, now: Date): Promise<PlannedRow[]> {
  const rows = Array.from({ length: count }, () => {
    const id = randomUUID();
    return { id, setId, storageKey: photoKey(setId, id), createdAt: now };
  });
  await tx.insert(photos).values(rows);
  return rows;
}

/**
 * One signed upload link per planned photo. If storage fails before any link
 * is handed out, no file can arrive: the places are taken back (and a new
 * set, which would count toward a daily limit).
 */
async function handOutLinks(db: Database, planned: Planned, storage: PhotoStorage): Promise<PhotoUpload[]> {
  try {
    return await Promise.all(
      planned.rows.map(async (row) => ({
        photoId: row.id,
        target: await storage.uploadTarget(row.storageKey, PHOTO_CONTENT_TYPE),
      })),
    );
  } catch (error) {
    if (planned.created) await db.delete(photoSets).where(eq(photoSets.id, planned.setId));
    else await db.delete(photos).where(inArray(photos.id, planned.rows.map((row) => row.id)));
    throw error;
  }
}

function isPhotoCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= PHOTO_RULES.maxPerSet;
}

/**
 * Makes room for `count` new photos: in the caller's set `setId`, or in a new
 * set. Pending rows count toward the 6, so two uploads at once can't go over
 * it; the set's row is locked while counting. A customer who started 5 open
 * sets in the last 24 hours gets "too-many-sets", so one account can't fill
 * the storage. Old photos are cleaned up first (deleteOldPhotos). If storage
 * fails before any link is handed out, the new rows are taken back.
 *
 * A job's set (photo_sets.booking_id, task 31) is "not-found" here: only
 * staff add to it, through startJobPhotoUpload.
 */
export async function startPhotoUpload(
  request: { setId?: string; count: number },
  { storage = photoStorage(), clock = systemClock }: PhotoDependencies = {},
): Promise<StartPhotoUploadResult> {
  const user = await authorizeUser();
  if (!isPhotoCount(request.count)) return { ok: false, problem: "bad-count" };
  if (request.setId !== undefined && !isUuid(request.setId)) return { ok: false, problem: "not-found" };

  await deleteOldPhotos({ storage, clock });

  const now = clock.now();
  const db = await getDatabase();
  const planned = await db.transaction(async (tx) => {
    // One customer's uploads one at a time, so two can't both pass a limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`photos:${user.id}`}))`);

    let setId = request.setId;
    if (setId === undefined) {
      // Job sets don't count: staff open those, not the customer.
      const [recent] = await tx
        .select({ value: count() })
        .from(photoSets)
        .where(
          and(
            eq(photoSets.userId, user.id),
            isNull(photoSets.bookingId),
            isNull(photoSets.closedAt),
            gt(photoSets.createdAt, new Date(now.getTime() - DAY_MS)),
          ),
        );
      if ((recent?.value ?? 0) >= PHOTO_RULES.maxNewSetsPerDay) return { ok: false as const, problem: "too-many-sets" as const };
      const [created] = await tx.insert(photoSets).values({ userId: user.id, createdAt: now }).returning({ id: photoSets.id });
      setId = created!.id;
    } else {
      const own = and(eq(photoSets.id, setId), eq(photoSets.userId, user.id), isNull(photoSets.bookingId))!;
      if (!(await lockOpenSet(tx, own, now))) return { ok: false as const, problem: "not-found" as const };
      if (!(await hasRoom(tx, setId, request.count))) return { ok: false as const, problem: "too-many-photos" as const };
    }

    const rows = await addPendingPhotos(tx, setId, request.count, now);
    return { ok: true as const, setId, created: request.setId === undefined, rows };
  });
  if (!planned.ok) return planned;
  return { ok: true, setId: planned.setId, uploads: await handOutLinks(db, planned, storage) };
}

/**
 * Makes room for `count` new photos of a job (task 31): in the job's set
 * `setId`, or in a new one. For staff with "jobs.update" on a booking they
 * may work on (job-access.ts: a mechanic only their assigned, unfinished
 * jobs); any other booking, a missing one and a malformed id are
 * "not-found". A completed job takes no more photos ("job-closed").
 *
 * The set belongs to the booking's customer (user_id) and to the job
 * (booking_id): the customer sees the photos, and deleting the customer's
 * data deletes them. There's no daily limit on staff sets; each still holds
 * at most 6 photos. The job's update links the set (updateJob), which closes
 * it.
 */
export async function startJobPhotoUpload(
  request: { bookingId: string; setId?: string; count: number },
  { storage = photoStorage(), clock = systemClock }: PhotoDependencies = {},
): Promise<StartJobPhotoUploadResult> {
  const user = await authorize("jobs.update");
  if (!isPhotoCount(request.count)) return { ok: false, problem: "bad-count" };
  if (!isUuid(request.bookingId) || (request.setId !== undefined && !isUuid(request.setId))) {
    return { ok: false, problem: "not-found" };
  }

  await deleteOldPhotos({ storage, clock });

  const now = clock.now();
  const db = await getDatabase();
  const planned = await db.transaction(async (tx) => {
    // The booking row, locked, so its photos are counted one upload at a time.
    const [job] = await tx
      .select({ customerId: bookings.userId, jobStatus: bookings.jobStatus })
      .from(bookings)
      .where(jobRowFilter(user, request.bookingId))
      .for("update");
    if (!job) return { ok: false as const, problem: "not-found" as const };
    if (job.jobStatus === "completed") return { ok: false as const, problem: "job-closed" as const };

    let setId = request.setId;
    if (setId === undefined) {
      const [created] = await tx
        .insert(photoSets)
        .values({ userId: job.customerId, bookingId: request.bookingId, createdAt: now })
        .returning({ id: photoSets.id });
      setId = created!.id;
    } else {
      const ofJob = and(eq(photoSets.id, setId), eq(photoSets.bookingId, request.bookingId))!;
      if (!(await lockOpenSet(tx, ofJob, now))) return { ok: false as const, problem: "not-found" as const };
      if (!(await hasRoom(tx, setId, request.count))) return { ok: false as const, problem: "too-many-photos" as const };
    }

    const rows = await addPendingPhotos(tx, setId, request.count, now);
    return { ok: true as const, setId, created: request.setId === undefined, rows };
  });
  if (!planned.ok) return planned;
  return { ok: true, setId: planned.setId, uploads: await handOutLinks(db, planned, storage) };
}

/** One photo after finishPhotoUpload: stored, or still pending (it can be sent again). */
export type FinishedPhoto = { photoId: string; stored: boolean };

/**
 * Checks each pending photo in `mine` in storage: there, a JPEG (by its first
 * bytes), at most 2 MB. A good one becomes "stored"; see finishPhotoUpload.
 */
async function storeArrivedPhotos(
  db: Database,
  mine: { id: string; storageKey: string }[],
  storage: PhotoStorage,
  clock: Clock,
): Promise<Set<string>> {
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
  return stored;
}

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
 * Ids that aren't the caller's pending photos, job photos among them
 * (finishJobPhotoUpload), come back as not stored.
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
    .where(and(inArray(photos.id, ids), eq(photoSets.userId, user.id), isNull(photoSets.bookingId), eq(photos.status, "pending")));

  const stored = await storeArrivedPhotos(db, mine, storage, clock);
  return photoIds.map((photoId) => ({ photoId, stored: stored.has(photoId) }));
}

/**
 * finishPhotoUpload for a job's photos (task 31): the same checks, for
 * pending photos in sets of jobs the caller may work on (job-access.ts).
 * Anything else comes back as not stored.
 */
export async function finishJobPhotoUpload(
  photoIds: readonly string[],
  { storage = photoStorage(), clock = systemClock }: PhotoDependencies = {},
): Promise<FinishedPhoto[]> {
  const user = await authorize("jobs.update");
  const ids = [...new Set(photoIds)].filter(isUuid);
  if (ids.length === 0) return photoIds.map((photoId) => ({ photoId, stored: false }));

  const db = await getDatabase();
  const mine = await db
    .select({ id: photos.id, storageKey: photos.storageKey })
    .from(photos)
    .innerJoin(photoSets, eq(photos.setId, photoSets.id))
    .innerJoin(bookings, eq(photoSets.bookingId, bookings.id))
    .where(and(inArray(photos.id, ids), eq(photos.status, "pending"), jobsOf(user)));

  const stored = await storeArrivedPhotos(db, mine, storage, clock);
  return photoIds.map((photoId) => ({ photoId, stored: stored.has(photoId) }));
}

export type PhotoViewResult = { ok: true; photos: { photoId: string; url: string }[] } | { ok: false; problem: "not-found" };

/**
 * Short-lived view links for a set's stored photos, oldest first, for:
 * - the set's customer (a job's set only once an update holds it, which
 *   closes it: staff choose what the customer sees);
 * - staff with "photos.view" (manager, owner);
 * - for a job's set (task 31), staff with "jobs.update" who may work on that
 *   job (job-access.ts): the assigned mechanic, until the job is reassigned
 *   or completed.
 * Everyone else gets "not-found", the same answer as a set that doesn't exist.
 */
export async function photoViewUrls(
  setId: string,
  { storage = photoStorage() }: PhotoDependencies = {},
): Promise<PhotoViewResult> {
  const user = await authorizeUser();
  if (!isUuid(setId)) return { ok: false, problem: "not-found" };
  const db = await getDatabase();
  const [set] = await db
    .select({ userId: photoSets.userId, bookingId: photoSets.bookingId, closedAt: photoSets.closedAt })
    .from(photoSets)
    .where(eq(photoSets.id, setId));
  if (!set) return { ok: false, problem: "not-found" };
  const customerMaySee = set.userId === user.id && (set.bookingId === null || set.closedAt !== null);
  if (!customerMaySee && !can(user.role, "photos.view") && !(await mayWorkOnJobOfSet(db, user, set.bookingId))) {
    return { ok: false, problem: "not-found" };
  }
  const links = await viewLinksFor([setId], storage);
  return { ok: true, photos: links.get(setId) ?? [] };
}

async function mayWorkOnJobOfSet(db: Database, user: CurrentUser, bookingId: string | null): Promise<boolean> {
  if (bookingId === null || !can(user.role, "jobs.update")) return false;
  const [job] = await db.select({ id: bookings.id }).from(bookings).where(jobRowFilter(user, bookingId));
  return job !== undefined;
}

/**
 * View links for the stored photos of several sets, oldest first in each,
 * by set id. No access check: for data-access code only (jobs.ts), after
 * its own check, like insertVehicleRow. Pages call photoViewUrls.
 */
export async function viewLinksFor(
  setIds: readonly string[],
  storage: PhotoStorage = photoStorage(),
): Promise<Map<string, { photoId: string; url: string }[]>> {
  const links = new Map<string, { photoId: string; url: string }[]>();
  if (setIds.length === 0) return links;
  const db = await getDatabase();
  const rows = await db
    .select({ id: photos.id, setId: photos.setId, storageKey: photos.storageKey })
    .from(photos)
    .where(and(inArray(photos.setId, [...setIds]), eq(photos.status, "stored")))
    .orderBy(asc(photos.createdAt), asc(photos.id));
  // All at once: on Supabase each link is a network call.
  const urls = await Promise.all(rows.map((row) => storage.viewUrl(row.storageKey, PHOTO_RULES.viewLinkSeconds)));
  rows.forEach((row, index) => {
    links.set(row.setId, [...(links.get(row.setId) ?? []), { photoId: row.id, url: urls[index]! }]);
  });
  return links;
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
