import { afterEach, describe, expect, test, vi } from "vitest";

import { realOrSamples, showSamples } from "@/lib/samples";

// Sample trust stats and reviews are made up. The owner decided on 2026-10-27
// that they show under `npm run dev` only, and never reach a production build
// (plan KTD7). These tests pin that gate.

describe("showSamples", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is true under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(showSamples()).toBe(true);
  });

  test("is false in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(showSamples()).toBe(false);
  });

  test("is false in tests", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(showSamples()).toBe(false);
  });

  test.each(["staging", "Development", ""])("is false for any other value (%j): only development shows samples", (value) => {
    vi.stubEnv("NODE_ENV", value);
    expect(showSamples()).toBe(false);
  });
});

describe("realOrSamples", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("real items win in every build, unmarked", () => {
    for (const nodeEnv of ["production", "development", "test"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(realOrSamples(["real"], ["sample"])).toEqual({ items: ["real"], sample: false });
    }
  });

  test("without real items: the samples, marked, under npm run dev; nothing otherwise", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(realOrSamples(null, ["sample"])).toEqual({ items: ["sample"], sample: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(realOrSamples(null, ["sample"])).toBeNull();
  });

  test("an empty list counts as no real items", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(realOrSamples([], ["sample"])).toBeNull();
  });
});
