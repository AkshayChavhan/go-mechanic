// Signed tokens for the fake photo storage's links (task 30): which file,
// which action, until when, and an HMAC-SHA256 over all three, so nobody can
// change one of them or make a token of their own. Supabase signs its own
// links; only the fake needs this.

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type PhotoAction = "upload" | "view";

export type PhotoToken = { key: string; action: PhotoAction; expiresAt: number };

/** A key just for photo links, made from the login secret, so the two never share a key. */
export function photoSigningKey(authSecret: string): Buffer {
  return createHmac("sha256", authSecret).update("photo links, version 1").digest();
}

function signature(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** The token for `token`: its fields, base64url-encoded, then a dot and the signature. */
export function signPhotoToken(token: PhotoToken, key: Buffer): string {
  const payload = Buffer.from(JSON.stringify([token.key, token.action, token.expiresAt])).toString("base64url");
  return `${payload}.${signature(payload, key)}`;
}

/**
 * The token's fields when its signature is right, its action is `action` and
 * it hasn't expired at `now`; otherwise null. Compares the signatures in
 * constant time, so their timing gives nothing away.
 */
export function readPhotoToken(raw: string, action: PhotoAction, key: Buffer, now: number): PhotoToken | null {
  const [payload, given, extra] = raw.split(".");
  if (!payload || !given || extra !== undefined) return null;
  const expected = Buffer.from(signature(payload, key));
  const received = Buffer.from(given);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  let fields: unknown;
  try {
    fields = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(fields) || fields.length !== 3) return null;
  const [fileKey, tokenAction, expiresAt] = fields as unknown[];
  if (typeof fileKey !== "string" || tokenAction !== action || typeof expiresAt !== "number") return null;
  if (now >= expiresAt) return null;
  return { key: fileKey, action, expiresAt };
}
