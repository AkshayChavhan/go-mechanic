import { describe, expect, test } from "vitest";

import { fitWithin } from "./resize-photo";

// resizePhoto itself needs a real browser's canvas: e2e/dev/photo-resize.spec.ts
// checks it on /dev/design.
describe("fitWithin", () => {
  test("a landscape photo gets 1600 on its width", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  test("a portrait photo gets 1600 on its height", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  test("a photo already small enough keeps its size: never enlarged", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  test("a very thin photo keeps at least one pixel", () => {
    expect(fitWithin(16000, 2, 1600)).toEqual({ width: 1600, height: 1 });
  });
});
