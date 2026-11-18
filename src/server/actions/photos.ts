"use server";

// The photo upload handshake (task 30), called by PhotoUploader:
// 1. startPhotos asks for room for N photos and gets one signed upload link
//    per photo;
// 2. the browser PUTs each resized JPEG straight to storage (never through
//    here: Server Actions accept at most 1 MB);
// 3. finishPhotos sends back every photo id from step 1, failed ones too,
//    and learns which were stored.
//
// The uploader calls these with plain values, not a form, so everything is
// checked as `unknown`: a Server Action is a public address anyone can post
// to. Only the set id, the count and the photo ids are read; a posted user
// id or anything else does nothing. Like the account's actions, each checks
// the locale, then who is logged in (requireUser), and the data-access layer
// checks again.

import "server-only";

import { PHOTO_RULES } from "@/domain/photos";
import { requireUser } from "@/server/auth/access";
import {
  finishPhotoUpload,
  type FinishedPhoto,
  startPhotoUpload,
  type StartPhotoUploadResult,
} from "@/server/dal/photos";

import { checkedLocale } from "./form-input";

/** Starts (or adds to) a photo set; see startPhotoUpload for the answers. */
export async function startPhotos(locale: string, request: unknown): Promise<StartPhotoUploadResult> {
  await requireUser(checkedLocale(locale));
  const { setId, count } = (typeof request === "object" && request !== null ? request : {}) as Record<string, unknown>;
  if (typeof count !== "number") return { ok: false, problem: "bad-count" };
  if (setId !== undefined && typeof setId !== "string") return { ok: false, problem: "not-found" };
  return startPhotoUpload(setId === undefined ? { count } : { setId, count });
}

/** Checks the uploaded photos and answers which were stored. */
export async function finishPhotos(locale: string, photoIds: unknown): Promise<FinishedPhoto[]> {
  await requireUser(checkedLocale(locale));
  if (!Array.isArray(photoIds)) return [];
  const ids = photoIds.filter((id): id is string => typeof id === "string").slice(0, PHOTO_RULES.maxPerSet);
  return finishPhotoUpload(ids);
}
