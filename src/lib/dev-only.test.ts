import { afterEach, describe, expect, test, vi } from "vitest";

import { devOnly } from "@/lib/dev-only";

// What notFound() throws: Next.js shows the 404 page when it catches it.
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

/** The error `run` throws (fails the test if it throws nothing). */
function errorFrom(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected an error, but nothing was thrown");
}

describe("devOnly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is a 404 in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(errorFrom(devOnly)).toMatchObject({ digest: NOT_FOUND });
  });

  test("is a 404 anywhere else that isn't development (here: tests)", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(errorFrom(devOnly)).toMatchObject({ digest: NOT_FOUND });
  });

  test("lets the page render under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => devOnly()).not.toThrow();
  });
});
