// What every photo storage does (task 30). The data-access layer
// (src/server/dal/photos.ts) only knows this shape, so the local fake and
// Supabase Storage are interchangeable.
//
// Keys are made by the server ("sets/<set id>/<photo id>.jpg", photoKey() in
// src/domain/photos.ts), never from a file name or anything a person typed.

import "server-only";

/** Where the browser sends one photo, and how. */
export type UploadTarget = {
  url: string;
  method: "PUT";
  /** Headers the browser must send with the photo. */
  headers: Record<string, string>;
};

/** What storage knows about a stored file. */
export type StoredFile = {
  bytes: number;
  contentType: string;
  /** The file's first bytes, to check it really is a JPEG (FF D8 FF). */
  firstBytes: Uint8Array;
};

export type PhotoStorage = {
  /**
   * A signed link that lets one browser upload one file to `key`, once. It
   * works for 10 minutes on the fake and 2 hours on Supabase (its fixed
   * lifetime), both well inside the 24 hours after which deleteOldPhotos
   * removes an unfinished upload, file included. PHOTO_RULES.maxBytes and
   * the JPEG type are enforced by the fake's Route Handler and by the
   * Supabase bucket's settings (task 20); finishPhotoUpload checks again.
   */
  uploadTarget(key: string, contentType: string): Promise<UploadTarget>;
  /** A signed link to view the file at `key`, working for `seconds`. */
  viewUrl(key: string, seconds: number): Promise<string>;
  /** The file at `key`, or null when there's none. */
  inspect(key: string): Promise<StoredFile | null>;
  /** Deletes the files; keys with no file are fine. */
  remove(keys: readonly string[]): Promise<void>;
};
