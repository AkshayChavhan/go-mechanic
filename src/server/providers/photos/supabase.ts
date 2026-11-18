// Photo storage in a private Supabase Storage bucket (task 30), through its
// REST API with fetch: no client package. Written now, tested here against a
// mocked fetch only; task 20 runs the real upload, view and delete against
// the staging bucket. Until then these request shapes count as unverified.
//
// The bucket must be created private, with a 2 MB file limit and image/jpeg
// as its only allowed type (task 20): a signed upload link can't carry a
// size or type limit, so the bucket enforces them. The provider never sends
// x-upsert, so a stored photo can't be replaced.
//
// The service role key is a secret. It goes only in the Authorization and
// apikey headers of requests from this server, never into a URL, an error
// message or the browser.

import "server-only";

import type { PhotoStorage, StoredFile } from "./types";

export type SupabasePhotoStorageOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetch?: typeof fetch;
};

/** How long one request to Supabase may take, so a stuck one never holds up an upload. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Thrown when Supabase answers with an error. Says what failed and the status, never a key or URL. */
export class PhotoStorageError extends Error {
  constructor(step: string, status: number) {
    super(`Photo storage: ${step} failed (HTTP ${status})`);
    this.name = "PhotoStorageError";
  }
}

/** `key` with each part URL-encoded, keeping the slashes. */
function encodedKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function createSupabasePhotoStorage(options: SupabasePhotoStorageOptions): PhotoStorage {
  const doFetch = options.fetch ?? fetch;
  const api = `${options.supabaseUrl}/storage/v1`;
  const auth = { Authorization: `Bearer ${options.serviceRoleKey}`, apikey: options.serviceRoleKey };
  const object = (key: string) => `${options.bucket}/${encodedKey(key)}`;

  /** A request that gives up after REQUEST_TIMEOUT_MS, as a PhotoStorageError (status 0). */
  async function send(step: string, url: string, init: RequestInit): Promise<Response> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new PhotoStorageError(step, 0);
    }
  }

  async function json(step: string, url: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await send(step, url, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new PhotoStorageError(step, response.status);
    return (await response.json()) as Record<string, unknown>;
  }

  /** Supabase answers with a path under /storage/v1 ("/object/upload/sign/..."). */
  function absolute(step: string, value: unknown): string {
    if (typeof value !== "string" || !value.startsWith("/")) throw new PhotoStorageError(step, 200);
    return `${api}${value}`;
  }

  return {
    async uploadTarget(key, contentType) {
      const answer = await json("upload link", `${api}/object/upload/sign/${object(key)}`, {});
      return { url: absolute("upload link", answer.url), method: "PUT", headers: { "Content-Type": contentType } };
    },
    async viewUrl(key, seconds) {
      const answer = await json("view link", `${api}/object/sign/${object(key)}`, { expiresIn: seconds });
      return absolute("view link", answer.signedURL);
    },
    async inspect(key): Promise<StoredFile | null> {
      // The first 3 bytes only: the answer's Content-Range has the full size,
      // its Content-Type the type, and the bytes say whether it's a JPEG.
      const response = await send("inspect", `${api}/object/authenticated/${object(key)}`, {
        headers: { ...auth, Range: "bytes=0-2" },
      });
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new PhotoStorageError("inspect", response.status);
      const firstBytes = new Uint8Array(await response.arrayBuffer()).slice(0, 3);
      const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1];
      const bytes = total !== undefined ? Number(total) : Number(response.headers.get("content-length") ?? NaN);
      if (!Number.isFinite(bytes)) throw new PhotoStorageError("inspect", response.status);
      return { bytes, contentType: response.headers.get("content-type") ?? "", firstBytes };
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const response = await send("remove", `${api}/object/${options.bucket}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: keys }),
      });
      if (!response.ok) throw new PhotoStorageError("remove", response.status);
    },
  };
}
