import { expect, test } from "@playwright/test";

import messages from "../../messages/en.json";
import { expectNoErrors, watchErrors } from "../helpers";

// The photo uploader sample on /dev/design (task 30), in a real browser
// against `next dev`. The unit tests (photo-uploader.test.tsx) replace the
// resize step; this checks the real one: a 4000×3000 phone-style JPEG with
// an EXIF block (where phones keep the GPS location) comes out 1600×1200,
// still a JPEG, with no EXIF left in it.

const t = messages.Photos.uploader;

/** A 4000×3000 JPEG with an EXIF block holding a marker text, made in the browser. */
const makePhoneJpeg = `(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 4000;
  canvas.height = 3000;
  const context = canvas.getContext("2d");
  context.fillStyle = "#3a6";
  context.fillRect(0, 0, 4000, 3000);
  context.fillStyle = "#fff";
  context.fillRect(400, 300, 1200, 900);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  // APP1 "Exif": a little-endian TIFF header, an empty first directory, then
  // a marker text standing in for GPS data.
  const body = [..."Exif\\0\\0"].map((c) => c.charCodeAt(0))
    .concat([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    .concat([..."GPS-MARKER-18.6298N-73.7997E"].map((c) => c.charCodeAt(0)));
  const length = body.length + 2;
  const app1 = [0xff, 0xe1, length >> 8, length & 0xff, ...body];
  const withExif = new Uint8Array(jpeg.length + app1.length);
  withExif.set(jpeg.subarray(0, 2), 0);
  withExif.set(app1, 2);
  withExif.set(jpeg.subarray(2), 2 + app1.length);
  let text = "";
  for (const byte of withExif) text += String.fromCharCode(byte);
  return btoa(text);
})()`;

test("a 4000×3000 photo with EXIF comes out 1600×1200, a JPEG with no EXIF", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/dev/design");
  const sample = page.locator('[data-sample="photo-uploader"]');
  await expect(sample.getByRole("button", { name: t.choose })).toBeEnabled();

  const original = Buffer.from((await page.evaluate(makePhoneJpeg)) as string, "base64");
  expect(original.includes("Exif")).toBe(true);
  expect(original.includes("GPS-MARKER")).toBe(true);
  await sample.locator('input[type="file"]').setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: original });

  const preview = sample.getByRole("img", { name: t.photoAlt.replace("{n}", "1") });
  await expect(preview).toBeVisible();
  const resized = await preview.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return { width: img.naturalWidth, height: img.naturalHeight, size: bytes.length, first: [...bytes.subarray(0, 3)], text };
  });
  expect({ width: resized.width, height: resized.height }).toEqual({ width: 1600, height: 1200 });
  expect(resized.first).toEqual([0xff, 0xd8, 0xff]);
  expect(resized.size).toBeLessThan(original.length);
  expect(resized.text.includes("Exif")).toBe(false);
  expect(resized.text.includes("GPS-MARKER")).toBe(false);

  // The stand-in upload: the button, then "Uploaded".
  await sample.getByRole("button", { name: t.upload }).click();
  await expect(sample.getByText(t.stored, { exact: true })).toBeVisible();
  await expect(sample.getByRole("status")).toHaveText(t.done.replace("{count}", "1"));
  await expectNoErrors(page, errors);
});
