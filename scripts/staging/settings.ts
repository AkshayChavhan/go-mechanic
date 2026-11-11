// Where the staging scripts find the staging database (task 20).
//
// The address lives in .env.staging on the owner's laptop, under
// STAGING_DATABASE_URL. Not .env.local, which `next dev`, `next build` and
// `next start` all load: the app uses postgres.js whenever DATABASE_URL is
// set, so `npm run dev` and `npm run test:e2e` would quietly use staging.
// The file is read here, never loaded into process.env, so even a DATABASE_URL
// typed into it can't reach anything else.
//
// The scripts use Supabase's session pooler (port 5432 on the pooler host):
// it works over IPv4 and keeps prepared statements, which drizzle's migrator
// uses. The transaction pooler (port 6543) is for the app only.

import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** The settings a script reads: process.env, or a plain object in tests. */
export type Environment = Record<string, string | undefined>;

export const STAGING_ENV_FILE = ".env.staging";
export const STAGING_URL_VARIABLE = "STAGING_DATABASE_URL";

/** A problem with the staging settings. Its message names a setting or a file, never a value. */
export class StagingSettingsError extends Error {
  override name = "StagingSettingsError";
}

/**
 * The staging database's address, from `.env.staging` (or, if the file isn't
 * there, from STAGING_DATABASE_URL in the environment). Throws a
 * StagingSettingsError when it's missing, isn't a Postgres address, or points
 * at the transaction pooler.
 */
export function readStagingDatabaseUrl(
  fileText: string | null = readEnvFile(),
  environment: Environment = process.env,
): string {
  const fromFile = fileText === null ? undefined : parseEnv(fileText)[STAGING_URL_VARIABLE];
  const url = (fromFile ?? environment[STAGING_URL_VARIABLE] ?? "").trim();
  if (url === "") {
    throw new StagingSettingsError(
      `${STAGING_URL_VARIABLE} is not set. Put it in ${STAGING_ENV_FILE} (document/operations/staging.md, "Supabase").`,
    );
  }
  checkStagingUrl(url);
  return url;
}

/** Refuses an address that isn't Postgres, or that uses the transaction pooler's port. */
export function checkStagingUrl(url: string, variable: string = STAGING_URL_VARIABLE): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not the TypeError itself: its `input` would carry the password.
    throw new StagingSettingsError(
      `${variable} is not a valid Postgres URL. Percent-encode special characters in the password ` +
        '("/" as %2F, "?" as %3F, "#" as %23, "@" as %40, "%" as %25).',
    );
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new StagingSettingsError(`${variable} must start with postgresql://.`);
  }
  if (parsed.port === "6543") {
    throw new StagingSettingsError(
      `${variable} points at Supabase's transaction pooler (port 6543). The staging scripts need the session pooler ` +
        "(port 5432 on the pooler host): Supabase, Connect, Session pooler.",
    );
  }
}

function readEnvFile(): string | null {
  const file = path.join(process.cwd(), STAGING_ENV_FILE);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}
