import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { photoKey, PHOTO_RULES } from "@/domain/photos";
import { fixedClock } from "@/lib/clock";

import { createFakePhotoStorage, type FakePhotoStorageOptions, handleFakeUpload, handleFakeView } from "./fake";
import { photoSigningKey, readPhotoToken, signPhotoToken } from "./token";

const dir = mkdtempSync(path.join(os.tmpdir(), "gomechanic-photos-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const now = new Date("2026-11-13T06:00:00Z");
const options: FakePhotoStorageOptions = { dir, signingKey: photoSigningKey("x".repeat(40)), clock: fixedClock(now) };
const storage = createFakePhotoStorage(options);

const setId = "0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69";
let n = 0;
let key: string;
beforeEach(() => {
  n += 1;
  key = photoKey(setId, `7c1e2d3f-4a5b-4c6d-8e7f-${String(n).padStart(12, "0")}`);
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/** A PUT of `body` to the upload link for `key`. */
async function upload(body: Uint8Array<ArrayBuffer>, contentType = "image/jpeg", url?: string) {
  const target = await storage.uploadTarget(key, "image/jpeg");
  return handleFakeUpload(
    // A browser sends the length of a Blob body; a Request built here doesn't, so set it.
    new Request(`http://localhost${url ?? target.url}`, {
      method: "PUT",
      body,
      headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength) },
    }),
    options,
  );
}

describe("the fake photo storage", () => {
  test("a signed upload stores the bytes, and inspect and a view link see them", async () => {
    expect((await upload(jpeg)).status).toBe(204);
    const info = await storage.inspect(key);
    expect(info).toMatchObject({ bytes: jpeg.byteLength, contentType: "image/jpeg" });
    expect([...info!.firstBytes]).toEqual([0xff, 0xd8, 0xff]);

    const view = await handleFakeView(new Request(`http://localhost${await storage.viewUrl(key, 60)}`), options);
    expect(view.status).toBe(200);
    expect(view.headers.get("cache-control")).toBe("private, no-store");
    expect(view.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await view.arrayBuffer())).toEqual(jpeg);
  });

  test("a stored photo can't be replaced: a second PUT is refused (409)", async () => {
    expect((await upload(jpeg)).status).toBe(204);
    expect((await upload(new Uint8Array([0xff, 0xd8, 0xff, 9]))).status).toBe(409);
  });

  test("refuses anything but a JPEG (415), an empty body (400) and a file over the limit (413)", async () => {
    expect((await upload(jpeg, "image/png")).status).toBe(415);
    expect((await upload(new Uint8Array())).status).toBe(400);
    expect((await upload(new Uint8Array(PHOTO_RULES.maxBytes + 1))).status).toBe(413);
  });

  test("refuses a body with no stated length (411), before reading it", async () => {
    const target = await storage.uploadTarget(key, "image/jpeg");
    const request = new Request(`http://localhost${target.url}`, {
      method: "PUT",
      body: jpeg,
      headers: { "Content-Type": "image/jpeg" },
    });
    expect((await handleFakeUpload(request, options)).status).toBe(411);
    expect(await storage.inspect(key)).toBeNull();
  });

  test("refuses an altered, expired or wrong-action token (403)", async () => {
    const target = await storage.uploadTarget(key, "image/jpeg");
    const token = new URL(`http://localhost${target.url}`).searchParams.get("t")!;
    const altered = `${token.slice(0, -2)}${token.endsWith("A") ? "B" : "A"}x`;
    expect((await upload(jpeg, "image/jpeg", `/api/photos/upload?t=${altered}`)).status).toBe(403);

    const expired = signPhotoToken({ key, action: "upload", expiresAt: now.getTime() }, options.signingKey);
    expect((await upload(jpeg, "image/jpeg", `/api/photos/upload?t=${expired}`)).status).toBe(403);

    const viewToken = new URL(`http://localhost${await storage.viewUrl(key, 60)}`).searchParams.get("t")!;
    expect((await upload(jpeg, "image/jpeg", `/api/photos/upload?t=${viewToken}`)).status).toBe(403);
  });

  test("a token signed with another key, or for another file, doesn't work", async () => {
    const other = signPhotoToken({ key, action: "view", expiresAt: now.getTime() + 60_000 }, photoSigningKey("y".repeat(40)));
    expect((await handleFakeView(new Request(`http://localhost/api/photos/view?t=${other}`), options)).status).toBe(403);
    expect(readPhotoToken(other, "view", options.signingKey, now.getTime())).toBeNull();
  });

  test("a view link for a missing file is 404; inspect gives null", async () => {
    expect((await handleFakeView(new Request(`http://localhost${await storage.viewUrl(key, 60)}`), options)).status).toBe(404);
    expect(await storage.inspect(key)).toBeNull();
  });

  test("remove deletes the files, and a missing one is fine", async () => {
    await upload(jpeg);
    await storage.remove([key, photoKey(setId, "11111111-2222-4333-8444-555555555555")]);
    expect(await storage.inspect(key)).toBeNull();
  });

  test("refuses a key that isn't a photo key", async () => {
    await expect(storage.uploadTarget("../outside.jpg", "image/jpeg")).rejects.toThrow();
    await expect(storage.inspect(`sets/${setId}/../../x.jpg`)).rejects.toThrow();
  });
});
