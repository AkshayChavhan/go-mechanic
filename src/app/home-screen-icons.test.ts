import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { HOME_SCREEN_ICONS } from "@/components/admin/home-screen";
import { LETTER_PATH } from "@/components/admin/home-screen-icon";

import { GET as apple } from "./admin-apple-icon.png/route";
import { GET as icon192 } from "./admin-icon-192.png/route";
import { GET as icon512 } from "./admin-icon-512.png/route";

// The staff area's home-screen icons (task 26, R10): PNGs drawn with
// ImageResponse from the same letter as icon.svg, at addresses ending in
// .png so the proxy skips them (src/proxy.test.ts).

/** Reads a PNG's width and height from its IHDR chunk (bytes 16 to 23). */
function pngSize(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect([...bytes.slice(0, 8)]).toEqual(signature);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Each address is the Route Handler folder of the same name under src/app/.
const cases = [
  { url: HOME_SCREEN_ICONS[192], folder: "/admin-icon-192.png", GET: icon192, size: 192 },
  { url: HOME_SCREEN_ICONS[512], folder: "/admin-icon-512.png", GET: icon512, size: 512 },
  { url: HOME_SCREEN_ICONS.apple, folder: "/admin-apple-icon.png", GET: apple, size: 180 },
];

describe("the home-screen icons", () => {
  test.each(cases)("$folder answers image/png at $size px", async ({ url, folder, GET, size }) => {
    expect(url).toBe(folder);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({ width: size, height: size });
  });

  test("draw the same letter as icon.svg", () => {
    const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
    expect(/<path fill="#ffffff" d="([^"]+)"/.exec(svg)?.[1]).toBe(LETTER_PATH);
  });
});
