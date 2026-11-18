import { describe, expect, test, vi } from "vitest";

import { createSupabasePhotoStorage, PhotoStorageError } from "./supabase";

// These tests check the requests against a mocked fetch: the shapes we expect
// Supabase Storage's REST API to have. Task 20 checks them against a real
// bucket.

const key = "sets/0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69/7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.jpg";
const secret = "fake-service-role-key";

function storageWith(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const storage = createSupabasePhotoStorage({ supabaseUrl: "https://ref.supabase.co", serviceRoleKey: secret, bucket: "photos", fetch: fetchMock });
  return { storage, fetchMock };
}

const call = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) => {
  const [url, init] = fetchMock.mock.calls[0]!;
  return { url: String(url), init: init!, headers: new Headers(init!.headers) };
};

describe("the Supabase photo storage", () => {
  test("an upload link: POST to upload/sign, answered with a path made absolute", async () => {
    const { storage, fetchMock } = storageWith(Response.json({ url: "/object/upload/sign/photos/x?token=abc" }));
    expect(await storage.uploadTarget(key, "image/jpeg")).toEqual({
      url: "https://ref.supabase.co/storage/v1/object/upload/sign/photos/x?token=abc",
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
    });
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe(`https://ref.supabase.co/storage/v1/object/upload/sign/photos/${key}`);
    expect(init.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(headers.get("x-upsert")).toBeNull();
  });

  test("a view link: POST to object/sign with expiresIn", async () => {
    const { storage, fetchMock } = storageWith(Response.json({ signedURL: "/object/sign/photos/x?token=def" }));
    expect(await storage.viewUrl(key, 300)).toBe("https://ref.supabase.co/storage/v1/object/sign/photos/x?token=def");
    expect(JSON.parse(String(call(fetchMock).init.body))).toEqual({ expiresIn: 300 });
  });

  test("inspect: asks for the first 3 bytes and reads the size from Content-Range", async () => {
    const { storage, fetchMock } = storageWith(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 206,
        headers: { "Content-Range": "bytes 0-2/123456", "Content-Type": "image/jpeg" },
      }),
    );
    const info = await storage.inspect(key);
    expect(info).toMatchObject({ bytes: 123456, contentType: "image/jpeg" });
    expect([...info!.firstBytes]).toEqual([0xff, 0xd8, 0xff]);
    expect(call(fetchMock).headers.get("range")).toBe("bytes=0-2");
  });

  test("every request carries a time limit; a failed or stuck one is a PhotoStorageError without the key", async () => {
    const { storage, fetchMock } = storageWith(Response.json({ url: "/object/upload/sign/photos/x?token=abc" }));
    await storage.uploadTarget(key, "image/jpeg");
    expect(call(fetchMock).init.signal).toBeInstanceOf(AbortSignal);

    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const error = await storage.inspect(key).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(PhotoStorageError);
    expect(String((error as Error).message)).not.toContain(key);
  });

  test("inspect: a missing file is null", async () => {
    const { storage } = storageWith(new Response(null, { status: 404 }));
    expect(await storage.inspect(key)).toBeNull();
  });

  test("remove: one DELETE with the keys as prefixes; none sends nothing", async () => {
    const { storage, fetchMock } = storageWith(Response.json([]));
    await storage.remove([key]);
    const { url, init } = call(fetchMock);
    expect(url).toBe("https://ref.supabase.co/storage/v1/object/photos");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({ prefixes: [key] });
    fetchMock.mockClear();
    await storage.remove([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an error answer throws PhotoStorageError with the step and status, never the key or the secret", async () => {
    const { storage } = storageWith(new Response("nope", { status: 500 }));
    const error = await storage.viewUrl(key, 60).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(PhotoStorageError);
    expect((error as Error).message).toBe("Photo storage: view link failed (HTTP 500)");
    expect((error as Error).message).not.toContain(secret);
    expect((error as Error).message).not.toContain("sets/");
  });
});
