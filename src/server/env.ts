// The server's settings, read from environment variables and checked in one
// place. Other server code calls serverEnv() instead of reading process.env.
//
//   APP_ENV       which deployment this is: "local" (the default), "staging"
//                 or "production". Task 20 sets it on Vercel.
//   DATABASE_URL  a Postgres URL (postgres:// or postgresql://). Required in
//                 staging and production. Locally it's optional: without it
//                 the app uses PGlite (src/server/db/index.ts).
//   BETTER_AUTH_SECRET
//                 signs the login cookie (src/server/auth/). At least 32
//                 characters. Required in staging and production; locally a
//                 fixed placeholder is used, which is safe only because a
//                 deployment can't run as local (see "local-on-vercel").
//   SMS_PROVIDER  who sends SMS: "fake" (the default, and the only one until
//                 task 44) stores them for /dev/outbox. Production refuses
//                 the fake, so production can't start before task 44.
//   E2E_OUTBOX_FILE
//                 the browser tests' copy of the fake's SMS (one JSON line
//                 each, playwright.config.ts). Local runs only: it's refused
//                 on staging, production and Vercel.
//   OWNER_PHONE_NUMBER
//                 whoever logs in with this mobile (E.164, "+919764750567") is
//                 the garage's owner (src/domain/roles.ts, effectiveRole).
//                 Required on staging and production; locally it defaults to
//                 the garage's own number (the owner's choice, 2026-10-28).
//                 Change it to move owner access, then redeploy (or restart
//                 the server): serverEnv() reads the settings once per
//                 process. From then on the old number is a customer, even
//                 inside a login that is already open.
//   PHOTO_STORAGE where customers' photos are kept (task 30): "fake" (the
//                 default) writes them to the .photos/ folder, for local runs
//                 only; "supabase" uses a private Supabase Storage bucket and
//                 needs the next three. Staging and production refuse the
//                 fake: a deployment's disk doesn't keep files.
//   SUPABASE_URL  the Supabase project's address (https://...supabase.co).
//   SUPABASE_SERVICE_ROLE_KEY
//                 the key the server uses for Storage. A secret: server only,
//                 never NEXT_PUBLIC_.
//   PHOTO_BUCKET  the private bucket's name, "photos" by default.
//
// DATABASE_URL, BETTER_AUTH_SECRET and SUPABASE_SERVICE_ROLE_KEY are secrets, so error messages name a
// variable but never print its value: errors end up in logs that more people
// can read.
//
// `import "server-only"` makes the build fail if a browser component ever
// imports this file, so the URL can't end up in the JavaScript visitors download.

import "server-only";

import { isIndianMobileNumber } from "@/lib/contact-links";

export const APP_ENVS = ["local", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

export const SMS_PROVIDERS = ["fake"] as const;

export type SmsProviderName = (typeof SMS_PROVIDERS)[number];

export const PHOTO_STORAGES = ["fake", "supabase"] as const;

export type PhotoStorageName = (typeof PHOTO_STORAGES)[number];

/** Where photos are kept, and what the Supabase provider needs. */
export type PhotoSettings =
  | { storage: "fake" }
  | { storage: "supabase"; supabaseUrl: string; serviceRoleKey: string; bucket: string };

/**
 * The local login secret. Clearly fake, and never used on a deployment:
 * staging and production must set BETTER_AUTH_SECRET.
 */
export const LOCAL_AUTH_SECRET = "local-only-login-secret-never-used-on-a-deployment";

/**
 * The owner's number for local runs: the garage's own number, as in the
 * database seed (src/server/db/seed-data.ts; env.test.ts checks they match).
 */
export const LOCAL_OWNER_PHONE_NUMBER = "+919764750567";

/** The shortest BETTER_AUTH_SECRET accepted. */
export const MIN_AUTH_SECRET_LENGTH = 32;

export type ServerEnv = {
  appEnv: AppEnv;
  /** The Postgres URL, or undefined to use PGlite (only allowed locally). */
  databaseUrl: string | undefined;
  /** Signs the login cookie. */
  authSecret: string;
  smsProvider: SmsProviderName;
  /** Where the fake SMS provider also writes each message, for the browser tests. */
  e2eOutboxFile: string | undefined;
  /** Whoever logs in with this number (E.164) is the owner. */
  ownerPhoneNumber: string;
  /** Where customers' photos are kept (task 30). */
  photos: PhotoSettings;
};

/** What's wrong with one variable. Codes, not sentences, like HoursProblem. */
export type ServerEnvProblem =
  | { variable: "APP_ENV"; problem: "unknown" | "local-on-vercel" }
  | { variable: "DATABASE_URL"; problem: "missing" | "not-postgres" }
  | { variable: "BETTER_AUTH_SECRET"; problem: "missing" | "too-short" }
  | { variable: "SMS_PROVIDER"; problem: "unknown-provider" | "fake-in-production" }
  | { variable: "E2E_OUTBOX_FILE"; problem: "local-only" }
  | { variable: "OWNER_PHONE_NUMBER"; problem: "missing" | "not-mobile" }
  | { variable: "PHOTO_STORAGE"; problem: "unknown-storage" | "fake-deployed" }
  | { variable: "SUPABASE_URL"; problem: "missing" | "not-https" }
  | { variable: "SUPABASE_SERVICE_ROLE_KEY"; problem: "missing" }
  | { variable: "PHOTO_BUCKET"; problem: "bad-bucket" };

// One readable line per problem. None of them includes a value.
const explanations: Record<ServerEnvProblem["problem"], string> = {
  unknown: `must be one of ${APP_ENVS[0]}, ${APP_ENVS[1]} or ${APP_ENVS[2]}`,
  "local-on-vercel": "must be staging or production on Vercel (it is unset or local)",
  missing: "is required when APP_ENV is staging or production",
  "not-postgres": "must start with postgres:// or postgresql://",
  "too-short": `must be at least ${MIN_AUTH_SECRET_LENGTH} characters long`,
  "unknown-provider": `must be ${SMS_PROVIDERS.join(" or ")}`,
  "fake-in-production": "can't be fake (the default) when APP_ENV is production: production sends real SMS (task 44)",
  "local-only": "is only for local test runs (APP_ENV local, not on Vercel)",
  "not-mobile": "must be an Indian mobile number written as +91 and 10 digits, with no spaces",
  "unknown-storage": `must be ${PHOTO_STORAGES.join(" or ")}`,
  "fake-deployed": "can't be fake (the default) outside local runs: a deployment's disk doesn't keep files (use supabase)",
  "not-https": "must start with https://",
  "bad-bucket": "must be lowercase letters, digits and hyphens",
};

/** Thrown by parseServerEnv, with every problem it found. */
export class ServerEnvError extends Error {
  readonly problems: ServerEnvProblem[];

  constructor(problems: ServerEnvProblem[]) {
    const lines = problems.map(({ variable, problem }) => `- ${variable} ${explanations[problem]}`);
    super(`The server's environment variables are wrong:\n${lines.join("\n")}`);
    this.name = "ServerEnvError";
    this.problems = problems;
  }
}

/** A variable's value, or undefined when it's missing or only spaces. */
function valueOf(vars: Record<string, string | undefined>, name: string): string | undefined {
  const value = vars[name]?.trim();
  return value ? value : undefined;
}

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

function isSmsProviderName(value: string): value is SmsProviderName {
  return (SMS_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Checks the variables and returns the settings, or throws one
 * ServerEnvError that lists every problem. Pure: tests pass a plain object.
 */
export function parseServerEnv(vars: Record<string, string | undefined>): ServerEnv {
  const problems: ServerEnvProblem[] = [];

  const rawAppEnv = valueOf(vars, "APP_ENV") ?? "local";
  const appEnv = isAppEnv(rawAppEnv) ? rawAppEnv : undefined;
  if (!appEnv) {
    problems.push({ variable: "APP_ENV", problem: "unknown" });
  } else if (appEnv === "local" && valueOf(vars, "VERCEL")) {
    // Vercel sets VERCEL=1 on every deployment. A deployment that forgot
    // APP_ENV would otherwise run as "local", with an empty in-memory database.
    problems.push({ variable: "APP_ENV", problem: "local-on-vercel" });
  }

  const databaseUrl = valueOf(vars, "DATABASE_URL");
  if (databaseUrl === undefined) {
    if (appEnv === "staging" || appEnv === "production") {
      problems.push({ variable: "DATABASE_URL", problem: "missing" });
    }
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push({ variable: "DATABASE_URL", problem: "not-postgres" });
  }

  const deployed = appEnv === "staging" || appEnv === "production";

  const setSecret = valueOf(vars, "BETTER_AUTH_SECRET");
  if (setSecret === undefined) {
    if (deployed) problems.push({ variable: "BETTER_AUTH_SECRET", problem: "missing" });
  } else if (setSecret.length < MIN_AUTH_SECRET_LENGTH) {
    problems.push({ variable: "BETTER_AUTH_SECRET", problem: "too-short" });
  }

  const rawSmsProvider = valueOf(vars, "SMS_PROVIDER") ?? "fake";
  const smsProvider = isSmsProviderName(rawSmsProvider) ? rawSmsProvider : undefined;
  if (!smsProvider) {
    problems.push({ variable: "SMS_PROVIDER", problem: "unknown-provider" });
  } else if (smsProvider === "fake" && appEnv === "production") {
    problems.push({ variable: "SMS_PROVIDER", problem: "fake-in-production" });
  }

  const e2eOutboxFile = valueOf(vars, "E2E_OUTBOX_FILE");
  if (e2eOutboxFile !== undefined && (appEnv !== "local" || valueOf(vars, "VERCEL"))) {
    problems.push({ variable: "E2E_OUTBOX_FILE", problem: "local-only" });
  }

  const setOwnerNumber = valueOf(vars, "OWNER_PHONE_NUMBER");
  if (setOwnerNumber === undefined) {
    if (deployed) problems.push({ variable: "OWNER_PHONE_NUMBER", problem: "missing" });
  } else if (!isIndianMobileNumber(setOwnerNumber)) {
    problems.push({ variable: "OWNER_PHONE_NUMBER", problem: "not-mobile" });
  }

  const photos = parsePhotoSettings(vars, appEnv, problems);

  // A missing appEnv or smsProvider always comes with a problem; checking
  // them too tells TypeScript that they're set below.
  if (problems.length > 0 || !appEnv || !smsProvider || !photos) throw new ServerEnvError(problems);
  return {
    appEnv,
    databaseUrl,
    authSecret: setSecret ?? LOCAL_AUTH_SECRET,
    smsProvider,
    e2eOutboxFile,
    ownerPhoneNumber: setOwnerNumber ?? LOCAL_OWNER_PHONE_NUMBER,
    photos,
  };
}

/** PHOTO_STORAGE and the Supabase settings; undefined when a problem was added. */
function parsePhotoSettings(
  vars: Record<string, string | undefined>,
  appEnv: AppEnv | undefined,
  problems: ServerEnvProblem[],
): PhotoSettings | undefined {
  const raw = valueOf(vars, "PHOTO_STORAGE") ?? "fake";
  if (!(PHOTO_STORAGES as readonly string[]).includes(raw)) {
    problems.push({ variable: "PHOTO_STORAGE", problem: "unknown-storage" });
    return undefined;
  }
  if (raw === "fake") {
    // Staging and production only: a deployment that says APP_ENV=local, or an
    // unknown APP_ENV, already fails on APP_ENV itself.
    if (appEnv === "staging" || appEnv === "production") {
      problems.push({ variable: "PHOTO_STORAGE", problem: "fake-deployed" });
      return undefined;
    }
    return { storage: "fake" };
  }
  const supabaseUrl = valueOf(vars, "SUPABASE_URL");
  const serviceRoleKey = valueOf(vars, "SUPABASE_SERVICE_ROLE_KEY");
  const bucket = valueOf(vars, "PHOTO_BUCKET") ?? "photos";
  const before = problems.length;
  if (supabaseUrl === undefined) problems.push({ variable: "SUPABASE_URL", problem: "missing" });
  else if (!supabaseUrl.startsWith("https://")) problems.push({ variable: "SUPABASE_URL", problem: "not-https" });
  if (serviceRoleKey === undefined) problems.push({ variable: "SUPABASE_SERVICE_ROLE_KEY", problem: "missing" });
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket)) problems.push({ variable: "PHOTO_BUCKET", problem: "bad-bucket" });
  if (problems.length > before || !supabaseUrl || !serviceRoleKey) return undefined;
  return { storage: "supabase", supabaseUrl: supabaseUrl.replace(/\/+$/, ""), serviceRoleKey, bucket };
}

let remembered: ServerEnv | undefined;

/**
 * The server's settings from process.env, checked on the first call and
 * remembered after that. Throws ServerEnvError while they're wrong (nothing
 * is remembered then, so every call throws).
 */
export function serverEnv(): ServerEnv {
  remembered ??= parseServerEnv(process.env);
  return remembered;
}
