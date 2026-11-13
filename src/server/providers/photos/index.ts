// The photo storage this deployment uses, picked by PHOTO_STORAGE
// (serverEnv().photos): the local fake, or Supabase Storage (task 30).

import "server-only";

import path from "node:path";

import { systemClock } from "@/lib/clock";
import { serverEnv } from "@/server/env";

import { createFakePhotoStorage, type FakePhotoStorageOptions } from "./fake";
import { createSupabasePhotoStorage } from "./supabase";
import { photoSigningKey } from "./token";
import type { PhotoStorage } from "./types";

export type { PhotoStorage, StoredFile, UploadTarget } from "./types";

/**
 * The folder the fake keeps photos in: .photos/ in the project. Git ignores
 * it, `npm run db:reset` deletes it, and next.config.ts leaves it out of the
 * build's file tracing, so no local photo is ever copied into a deployment.
 */
export const FAKE_PHOTO_DIR = path.join(process.cwd(), ".photos");

/** The fake's settings, for its Route Handlers. Null when this deployment doesn't use the fake. */
export function fakePhotoOptions(): FakePhotoStorageOptions | null {
  const env = serverEnv();
  if (env.photos.storage !== "fake") return null;
  return { dir: FAKE_PHOTO_DIR, signingKey: photoSigningKey(env.authSecret), clock: systemClock };
}

export function photoStorage(): PhotoStorage {
  const { photos } = serverEnv();
  switch (photos.storage) {
    case "fake":
      return createFakePhotoStorage(fakePhotoOptions()!);
    case "supabase":
      return createSupabasePhotoStorage(photos);
  }
}
