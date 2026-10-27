import { afterEach, describe, expect, test, vi } from "vitest";

import { showSamples } from "@/lib/samples";

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
