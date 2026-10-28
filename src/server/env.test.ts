import { afterEach, describe, expect, test, vi } from "vitest";

import { parseServerEnv, ServerEnvError } from "./env";

// parseServerEnv takes a plain object, so each test passes exactly the
// variables it needs instead of changing process.env.

const supabaseUrl = "postgresql://postgres.abc:fake-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

/** The error parseServerEnv throws for `vars` (fails the test if it doesn't throw). */
function errorFor(vars: Record<string, string | undefined>): ServerEnvError {
  try {
    parseServerEnv(vars);
  } catch (error) {
    if (error instanceof ServerEnvError) return error;
    throw error;
  }
  throw new Error("expected parseServerEnv to throw");
}

describe("parseServerEnv (checks the server's settings)", () => {
  test("with no variables, it's a local run with no database URL", () => {
    expect(parseServerEnv({})).toEqual({ appEnv: "local", databaseUrl: undefined });
  });

  test("an empty value counts as not set", () => {
    expect(parseServerEnv({ APP_ENV: "", DATABASE_URL: "  " })).toEqual({ appEnv: "local", databaseUrl: undefined });
  });

  test("a local run may use a real Postgres URL", () => {
    expect(parseServerEnv({ DATABASE_URL: "postgres://localhost:5432/gomechanic" })).toEqual({
      appEnv: "local",
      databaseUrl: "postgres://localhost:5432/gomechanic",
    });
  });

  test("production with a postgresql:// URL passes", () => {
    expect(parseServerEnv({ APP_ENV: "production", DATABASE_URL: supabaseUrl, VERCEL: "1" })).toEqual({
      appEnv: "production",
      databaseUrl: supabaseUrl,
    });
  });

  test.each(["staging", "production"])("%s without DATABASE_URL throws and names DATABASE_URL", (appEnv) => {
    const error = errorFor({ APP_ENV: appEnv });
    expect(error.problems).toEqual([{ variable: "DATABASE_URL", problem: "missing" }]);
    expect(error.message).toContain("DATABASE_URL");
  });

  test("a URL that isn't Postgres throws without showing the URL or its password", () => {
    const url = "mysql://user:s3cret@host/db";
    const error = errorFor({ DATABASE_URL: url });
    expect(error.problems).toEqual([{ variable: "DATABASE_URL", problem: "not-postgres" }]);
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).not.toContain("s3cret");
    expect(error.message).not.toContain(url);
    // The value isn't hiding anywhere else on the error either.
    expect(JSON.stringify(error.problems)).not.toContain("s3cret");
  });

  test("an unknown APP_ENV throws and lists the allowed values", () => {
    const error = errorFor({ APP_ENV: "prod" });
    expect(error.problems).toEqual([{ variable: "APP_ENV", problem: "unknown" }]);
    expect(error.message).toContain("APP_ENV");
    expect(error.message).toContain("local, staging or production");
  });

  test("on Vercel, a missing APP_ENV throws (it would default to local)", () => {
    const error = errorFor({ VERCEL: "1", DATABASE_URL: supabaseUrl });
    expect(error.problems).toEqual([{ variable: "APP_ENV", problem: "local-on-vercel" }]);
    expect(error.message).toContain("APP_ENV");
  });

  test("on Vercel, APP_ENV=local throws too", () => {
    expect(errorFor({ VERCEL: "1", APP_ENV: "local" }).problems).toEqual([
      { variable: "APP_ENV", problem: "local-on-vercel" },
    ]);
  });

  test("two problems at once are both listed in one error", () => {
    const error = errorFor({ APP_ENV: "prod", DATABASE_URL: "mysql://user:s3cret@host/db" });
    expect(error.problems).toEqual([
      { variable: "APP_ENV", problem: "unknown" },
      { variable: "DATABASE_URL", problem: "not-postgres" },
    ]);
    expect(error.message).toContain("APP_ENV");
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).not.toContain("s3cret");
  });
});

describe("serverEnv (reads process.env once)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("reads process.env and keeps the first answer", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DATABASE_URL", supabaseUrl);
    vi.resetModules();
    const { serverEnv } = await import("./env");

    expect(serverEnv()).toEqual({ appEnv: "staging", databaseUrl: supabaseUrl });

    vi.stubEnv("APP_ENV", "production");
    expect(serverEnv().appEnv).toBe("staging");
  });

  test("throws on every call while the settings are wrong", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    const { serverEnv, ServerEnvError: FreshServerEnvError } = await import("./env");

    expect(() => serverEnv()).toThrow(FreshServerEnvError);
    expect(() => serverEnv()).toThrow(FreshServerEnvError);
  });
});
