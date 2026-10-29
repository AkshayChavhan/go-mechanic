import { afterEach, describe, expect, test, vi } from "vitest";

import { ownerGarage } from "./db/seed-data";
import { LOCAL_AUTH_SECRET, LOCAL_OWNER_PHONE_NUMBER, parseServerEnv, ServerEnvError } from "./env";

// parseServerEnv takes a plain object, so each test passes exactly the
// variables it needs instead of changing process.env.

const supabaseUrl = "postgresql://postgres.abc:fake-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
const secret = "fake-secret-0123456789-abcdefghij-klmnop";

/** An owner's number for deployed settings (any Indian mobile). */
const ownerNumber = "+919812345678";

/** What a local run gets for the settings a test doesn't set. */
const localDefaults = {
  authSecret: LOCAL_AUTH_SECRET,
  smsProvider: "fake",
  e2eOutboxFile: undefined,
  ownerPhoneNumber: LOCAL_OWNER_PHONE_NUMBER,
} as const;

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
    expect(parseServerEnv({})).toEqual({ appEnv: "local", databaseUrl: undefined, ...localDefaults });
  });

  test("an empty value counts as not set", () => {
    expect(parseServerEnv({ APP_ENV: "", DATABASE_URL: "  ", BETTER_AUTH_SECRET: "", SMS_PROVIDER: " " })).toEqual({
      appEnv: "local",
      databaseUrl: undefined,
      ...localDefaults,
    });
  });

  test("a local run may use a real Postgres URL", () => {
    expect(parseServerEnv({ DATABASE_URL: "postgres://localhost:5432/gomechanic" })).toEqual({
      appEnv: "local",
      databaseUrl: "postgres://localhost:5432/gomechanic",
      ...localDefaults,
    });
  });

  test("staging with a postgresql:// URL and a secret passes, with the fake SMS provider", () => {
    expect(
      parseServerEnv({
        APP_ENV: "staging",
        DATABASE_URL: supabaseUrl,
        BETTER_AUTH_SECRET: secret,
        OWNER_PHONE_NUMBER: ownerNumber,
        VERCEL: "1",
      }),
    ).toEqual({
      appEnv: "staging",
      databaseUrl: supabaseUrl,
      authSecret: secret,
      smsProvider: "fake",
      e2eOutboxFile: undefined,
      ownerPhoneNumber: ownerNumber,
    });
  });

  test("production refuses the fake SMS provider, set or by default: it can't start before task 44", () => {
    const complete = {
      APP_ENV: "production",
      DATABASE_URL: supabaseUrl,
      BETTER_AUTH_SECRET: secret,
      OWNER_PHONE_NUMBER: ownerNumber,
      VERCEL: "1",
    };
    for (const vars of [complete, { ...complete, SMS_PROVIDER: "fake" }]) {
      const error = errorFor(vars);
      expect(error.problems).toEqual([{ variable: "SMS_PROVIDER", problem: "fake-in-production" }]);
      expect(error.message).toContain("SMS_PROVIDER");
    }
  });

  test.each(["staging", "production"])(
    "%s without DATABASE_URL or BETTER_AUTH_SECRET throws and names both",
    (appEnv) => {
      const error = errorFor({ APP_ENV: appEnv, SMS_PROVIDER: "fake" });
      expect(error.problems).toEqual(
        expect.arrayContaining([
          { variable: "DATABASE_URL", problem: "missing" },
          { variable: "BETTER_AUTH_SECRET", problem: "missing" },
        ]),
      );
      expect(error.message).toContain("DATABASE_URL");
      expect(error.message).toContain("BETTER_AUTH_SECRET");
    },
  );

  test("the owner's number defaults locally to the garage's own number (the owner's choice, 2026-10-28)", () => {
    expect(LOCAL_OWNER_PHONE_NUMBER).toBe(ownerGarage.phone);
    expect(parseServerEnv({}).ownerPhoneNumber).toBe(ownerGarage.phone);
  });

  test("the owner's number can be set to any Indian mobile", () => {
    expect(parseServerEnv({ OWNER_PHONE_NUMBER: ownerNumber }).ownerPhoneNumber).toBe(ownerNumber);
  });

  test.each(["staging", "production"])("%s without OWNER_PHONE_NUMBER throws and names it", (appEnv) => {
    const error = errorFor({ APP_ENV: appEnv, DATABASE_URL: supabaseUrl, BETTER_AUTH_SECRET: secret });
    expect(error.problems).toContainEqual({ variable: "OWNER_PHONE_NUMBER", problem: "missing" });
    expect(error.message).toContain("OWNER_PHONE_NUMBER");
  });

  test.each([
    ["with spaces", "+91 97647 50567"],
    ["without +91", "9764750567"],
    ["a landline", "+912012345678"],
  ])("an owner's number %s is refused, without showing it", (_case, value) => {
    const error = errorFor({ OWNER_PHONE_NUMBER: value });
    expect(error.problems).toEqual([{ variable: "OWNER_PHONE_NUMBER", problem: "not-mobile" }]);
    expect(error.message).toContain("OWNER_PHONE_NUMBER");
    expect(error.message).not.toContain(value);
  });

  test("a local run may set its own secret", () => {
    expect(parseServerEnv({ BETTER_AUTH_SECRET: secret }).authSecret).toBe(secret);
  });

  test("the local placeholder secret is long enough, and isn't Better Auth's built-in default", () => {
    expect(LOCAL_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(LOCAL_AUTH_SECRET).not.toBe("better-auth-secret-12345678901234567890");
  });

  test("a secret shorter than 32 characters throws without showing it", () => {
    const short = "short-secret-20chars";
    const error = errorFor({ BETTER_AUTH_SECRET: short });
    expect(error.problems).toEqual([{ variable: "BETTER_AUTH_SECRET", problem: "too-short" }]);
    expect(error.message).toContain("at least 32 characters");
    expect(error.message).not.toContain(short);
  });

  test("an unknown SMS provider throws and lists the allowed one", () => {
    const error = errorFor({ SMS_PROVIDER: "msg91" });
    expect(error.problems).toEqual([{ variable: "SMS_PROVIDER", problem: "unknown-provider" }]);
    expect(error.message).toContain("SMS_PROVIDER must be fake");
  });

  test("the browser tests' outbox file works locally", () => {
    expect(parseServerEnv({ E2E_OUTBOX_FILE: "/tmp/outbox.jsonl" }).e2eOutboxFile).toBe("/tmp/outbox.jsonl");
  });

  test.each([
    { APP_ENV: "staging", DATABASE_URL: supabaseUrl, BETTER_AUTH_SECRET: secret },
    { APP_ENV: "production", DATABASE_URL: supabaseUrl, BETTER_AUTH_SECRET: secret },
  ])("the outbox file is refused outside local runs ($APP_ENV)", (vars) => {
    expect(errorFor({ ...vars, E2E_OUTBOX_FILE: "/tmp/outbox.jsonl" }).problems).toContainEqual({
      variable: "E2E_OUTBOX_FILE",
      problem: "local-only",
    });
  });

  test("the outbox file is refused on Vercel even when APP_ENV says local", () => {
    expect(errorFor({ VERCEL: "1", E2E_OUTBOX_FILE: "/tmp/outbox.jsonl" }).problems).toEqual([
      { variable: "APP_ENV", problem: "local-on-vercel" },
      { variable: "E2E_OUTBOX_FILE", problem: "local-only" },
    ]);
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
    vi.stubEnv("BETTER_AUTH_SECRET", secret);
    vi.stubEnv("OWNER_PHONE_NUMBER", ownerNumber);
    vi.resetModules();
    const { serverEnv } = await import("./env");

    expect(serverEnv()).toEqual({
      appEnv: "staging",
      databaseUrl: supabaseUrl,
      authSecret: secret,
      smsProvider: "fake",
      e2eOutboxFile: undefined,
      ownerPhoneNumber: ownerNumber,
    });

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
