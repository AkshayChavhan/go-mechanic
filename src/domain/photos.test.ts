import { describe, expect, test } from "vitest";

import { isPhotoKey, isUuid, looksLikeJpeg, PHOTO_RULES, photoKey } from "./photos";

const setId = "0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69";
const photoId = "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

describe("photo keys", () => {
  test("are made from the two ids", () => {
    expect(photoKey(setId, photoId)).toBe(`sets/${setId}/${photoId}.jpg`);
    expect(isPhotoKey(photoKey(setId, photoId))).toBe(true);
  });

  test.each(["../etc/passwd", `sets/${setId}/../${photoId}.jpg`, `sets/${setId}/${photoId}.png`, `other/${setId}/${photoId}.jpg`, ""])(
    "%j is not a photo key",
    (key) => {
      expect(isPhotoKey(key)).toBe(false);
    },
  );

  test("refuse ids that aren't uuids", () => {
    expect(() => photoKey("..", photoId)).toThrow();
    expect(isUuid(setId)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

test("looksLikeJpeg checks the first three bytes", () => {
  expect(looksLikeJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
  expect(looksLikeJpeg(new Uint8Array([0x3c, 0x73, 0x76]))).toBe(false); // "<sv"
  expect(looksLikeJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
});

test("the owner's numbers (2026-11-13)", () => {
  expect(PHOTO_RULES).toMatchObject({ maxPerSet: 6, longSide: 1600, keepClosedDays: 365, keepOpenDays: 30 });
});
