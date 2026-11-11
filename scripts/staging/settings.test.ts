import { inspect } from "node:util";

import { describe, expect, test } from "vitest";

import { type Environment, readStagingDatabaseUrl, StagingSettingsError } from "./settings";

const sessionPooler = "postgresql://postgres.abcd:fake-password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

/** The error readStagingDatabaseUrl throws, or a failure if it doesn't throw. */
function failure(fileText: string | null, environment: Environment = {}): StagingSettingsError {
  try {
    readStagingDatabaseUrl(fileText, environment);
  } catch (error) {
    expect(error).toBeInstanceOf(StagingSettingsError);
    return error as StagingSettingsError;
  }
  throw new Error("expected readStagingDatabaseUrl to throw");
}

describe("readStagingDatabaseUrl", () => {
  test("reads STAGING_DATABASE_URL from the .env.staging text", () => {
    expect(readStagingDatabaseUrl(`STAGING_DATABASE_URL=${sessionPooler}\n`, {})).toBe(sessionPooler);
  });

  test("falls back to the environment when there's no .env.staging", () => {
    expect(readStagingDatabaseUrl(null, { STAGING_DATABASE_URL: sessionPooler })).toBe(sessionPooler);
  });

  test("missing everywhere: names the setting and the file", () => {
    const error = failure(null);
    expect(error.message).toContain("STAGING_DATABASE_URL is not set");
    expect(error.message).toContain(".env.staging");
  });

  test("ignores DATABASE_URL, even in the file: only the staging name counts", () => {
    expect(failure(`DATABASE_URL=${sessionPooler}\n`, { DATABASE_URL: sessionPooler }).message).toContain("is not set");
  });

  test("refuses the transaction pooler (port 6543) and names the session pooler as the fix", () => {
    const error = failure(`STAGING_DATABASE_URL=${sessionPooler.replace(":5432/", ":6543/")}\n`);
    expect(error.message).toContain("port 6543");
    expect(error.message).toContain("Session pooler");
    expect(inspect(error)).not.toContain("fake-password");
  });

  test("refuses an address that isn't Postgres", () => {
    expect(failure("STAGING_DATABASE_URL=https://example.com/\n").message).toContain("postgresql://");
  });

  test("an unencoded password is refused without the password in the error", () => {
    const error = failure("STAGING_DATABASE_URL=postgresql://u:fake/s3cret@db.example.com:5432/postgres\n");
    expect(error.message).toContain("STAGING_DATABASE_URL is not a valid Postgres URL");
    expect(inspect(error, { depth: 10 })).not.toContain("s3cret");
  });

  test("reading the settings never changes the environment", () => {
    const environment: Environment = {};
    readStagingDatabaseUrl(`STAGING_DATABASE_URL=${sessionPooler}\nDATABASE_URL=${sessionPooler}\nAPP_ENV=staging\n`, environment);
    expect(environment).toEqual({});
    expect(process.env.APP_ENV).not.toBe("staging");
  });
});
