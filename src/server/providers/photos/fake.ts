// The fake photo storage (task 30): files in a folder on this computer
// (.photos/ under `npm run dev`), for local runs and tests only. serverEnv()
// refuses it on staging and production, where a deployment's disk doesn't
// keep files.
//
// It signs its own links (token.ts) and serves them from two Route Handlers,
// /api/photos/upload and /api/photos/view, which call the handlers below.
// They behave like Supabase Storage: a link writes one file, at one key, for
// a few minutes, and a stored file is never replaced.

import "server-only";

import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { isPhotoKey, PHOTO_CONTENT_TYPE, PHOTO_RULES } from "@/domain/photos";
import type { Clock } from "@/lib/clock";

import { readPhotoToken, signPhotoToken } from "./token";
import type { PhotoStorage, StoredFile } from "./types";

export type FakePhotoStorageOptions = {
  /** The folder the files go in. */
  dir: string;
  /** The signing key (photoSigningKey()). */
  signingKey: Buffer;
  clock: Clock;
};

/** The file's path inside `dir`; refuses anything that isn't a photo key. */
function fileFor(dir: string, key: string): string {
  if (!isPhotoKey(key)) throw new Error("fake photo storage: not a photo key");
  return path.join(dir, key);
}

export function createFakePhotoStorage({ dir, signingKey, clock }: FakePhotoStorageOptions): PhotoStorage {
  const expiry = (seconds: number) => clock.now().getTime() + seconds * 1000;
  return {
    async uploadTarget(key, contentType) {
      fileFor(dir, key);
      const token = signPhotoToken({ key, action: "upload", expiresAt: expiry(PHOTO_RULES.uploadLinkSeconds) }, signingKey);
      return { url: `/api/photos/upload?t=${token}`, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async viewUrl(key, seconds) {
      fileFor(dir, key);
      return `/api/photos/view?t=${signPhotoToken({ key, action: "view", expiresAt: expiry(seconds) }, signingKey)}`;
    },
    async inspect(key): Promise<StoredFile | null> {
      const file = fileFor(dir, key);
      try {
        const info = await stat(file);
        const handle = await open(file, "r");
        try {
          const firstBytes = new Uint8Array(3);
          await handle.read(firstBytes, 0, 3, 0);
          return { bytes: info.size, contentType: PHOTO_CONTENT_TYPE, firstBytes };
        } finally {
          await handle.close();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(keys) {
      await Promise.all(keys.map((key) => rm(fileFor(dir, key), { force: true })));
    },
  };
}

/** The token from a request's `t` parameter. */
function tokenOf(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

const plain = (status: number) => new Response(null, { status });

/**
 * PUT /api/photos/upload?t=…: stores the body at the token's key. 403 for a
 * bad or expired token, 415 for anything but a JPEG, 413 over the size limit,
 * 409 when the key already has a file (a finished photo can't be replaced).
 */
export async function handleFakeUpload(request: Request, options: FakePhotoStorageOptions): Promise<Response> {
  const token = readPhotoToken(tokenOf(request), "upload", options.signingKey, options.clock.now().getTime());
  if (!token || !isPhotoKey(token.key)) return plain(403);
  if (request.headers.get("content-type") !== PHOTO_CONTENT_TYPE) return plain(415);
  // A size up front, so a huge body is refused before it is read.
  const length = request.headers.get("content-length");
  if (length === null) return plain(411);
  if (Number(length) > PHOTO_RULES.maxBytes) return plain(413);
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) return plain(400);
  if (body.byteLength > PHOTO_RULES.maxBytes) return plain(413);

  const file = fileFor(options.dir, token.key);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    // "wx": create only if there is no file yet.
    const handle = await open(file, "wx");
    try {
      await handle.writeFile(body);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return plain(409);
    throw error;
  }
  return plain(204);
}

/** GET /api/photos/view?t=…: the file, never cached and never sniffed as another type. */
export async function handleFakeView(request: Request, options: FakePhotoStorageOptions): Promise<Response> {
  const token = readPhotoToken(tokenOf(request), "view", options.signingKey, options.clock.now().getTime());
  if (!token || !isPhotoKey(token.key)) return plain(403);
  try {
    const body = await readFile(fileFor(options.dir, token.key));
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": PHOTO_CONTENT_TYPE,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return plain(404);
    throw error;
  }
}
