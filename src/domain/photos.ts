// The rules for customers' photos (task 30): how many, how big, how long
// links work, and how long photos are kept. Pure: no Next.js, React or
// database imports. The privacy notice reads its numbers from here (through
// PRIVACY_NOTICE_VALUES in consent.ts), so changing one changes the notice.

export const PHOTO_RULES = {
  /** Photos in one set: one estimate request or one job update (owner, 2026-11-13). */
  maxPerSet: 6,
  /** The long side of a resized photo, in pixels (owner, 2026-11-13). */
  longSide: 1600,
  /** The largest stored file. A 1600px JPEG is about 300 KB; this leaves room. */
  maxBytes: 2 * 1024 * 1024,
  /** How long an upload link works. */
  uploadLinkSeconds: 10 * 60,
  /** How long a view link works. */
  viewLinkSeconds: 5 * 60,
  /** A closed set is deleted this many days after it closed (owner, 2026-11-13). */
  keepClosedDays: 365,
  /** A set never closed is deleted this many days after it was started (owner, 2026-11-13). */
  keepOpenDays: 30,
  /** An upload never finished is deleted after this many hours. */
  keepPendingHours: 24,
  /** One customer may start at most this many sets in 24 hours. */
  maxNewSetsPerDay: 5,
} as const;

/** The only type stored: the browser re-encodes every photo as JPEG. */
export const PHOTO_CONTENT_TYPE = "image/jpeg";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^sets/${UUID}/${UUID}\\.jpg$`);

/** True for a uuid in its usual lowercase form. */
export function isUuid(value: string): boolean {
  return new RegExp(`^${UUID}$`).test(value);
}

/** Where a photo is stored: made from the set's and the photo's ids, never from anything a person typed. */
export function photoKey(setId: string, photoId: string): string {
  const key = `sets/${setId}/${photoId}.jpg`;
  if (!KEY.test(key)) throw new Error("photoKey: the ids must be uuids");
  return key;
}

/** True for a key photoKey() could have made (no "..", no other folders). */
export function isPhotoKey(key: string): boolean {
  return KEY.test(key);
}

/** True when the bytes start like a JPEG file (FF D8 FF). */
export function looksLikeJpeg(firstBytes: Uint8Array): boolean {
  return firstBytes.length >= 3 && firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff;
}

/** A photo's row is "pending" until its upload is checked, then "stored". */
export const PHOTO_STATUSES = ["pending", "stored"] as const;

export type PhotoStatus = (typeof PHOTO_STATUSES)[number];
