// Better Auth: the library that checks login codes and keeps sessions.
//
// How it's used here:
// - Only our own server code calls it (`auth.api.*`), from the login Server
//   Actions. There is no Better Auth web address (no Route Handler) and no
//   Better Auth code in the browser. Its built-in rate limiter and origin
//   check only guard those web addresses, so it's switched off here: our
//   limits live in the login service (src/server/auth/login.ts), and Next.js
//   checks the origin of every Server Action itself.
// - It stores everything in our database, through Drizzle, in the tables
//   from src/server/db/schema.ts (users, sessions, accounts, verifications).
// - createAuth builds one from its parts, so tests can pass a test database
//   and a fake SMS sender. getAuth (src/server/auth/instance.ts) builds the
//   app's own, once per process. A change here needs a dev-server restart.

import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";

import { LOGIN_RULES } from "@/domain/login";
import { isIndianMobileNumber } from "@/lib/contact-links";
import type { Database } from "@/server/db";
import { accounts, sessions, users, verifications } from "@/server/db/schema";

export type AuthDependencies = {
  db: Database;
  /** Signs the session cookie. At least 32 characters (serverEnv checks it). */
  secret: string;
  /** Cookies only over HTTPS: true on staging and production. */
  secureCookies: boolean;
  /** Sends a login code by SMS. A rejection fails the send. */
  sendCode: (phoneNumber: string, code: string) => Promise<void>;
  /**
   * Runs after a correct code, once the user exists and before the session
   * is created. Throwing refuses the login: no session, no cookie.
   */
  onVerified: (userId: string, phoneNumber: string) => Promise<void>;
};

/**
 * Better Auth's log lines, without their details. Better Auth adds the
 * error it caught to some lines, and a database error carries the query's
 * values: phone numbers, codes, session tokens. Only the level and the
 * message are printed.
 */
function logWithoutDetails(level: "info" | "success" | "warn" | "error" | "debug", message: unknown): void {
  // Better Auth needs its own web address only for its web endpoints (email
  // links, OAuth callbacks), which this site doesn't have. Without this, every
  // process would print that warning once.
  if (typeof message === "string" && message.includes("Base URL is not set")) return;
  const line = `[Better Auth] ${typeof message === "string" ? message : "(details hidden)"}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function createAuth({ db, secret, secureCookies, sendCode, onVerified }: AuthDependencies) {
  return betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      // Better Auth's name for each table: ours.
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    logger: { log: logWithoutDetails },
    session: {
      expiresIn: LOGIN_RULES.sessionDays * 24 * 60 * 60,
      // A login lasts 30 days from the moment the code was typed, however
      // often the person visits (the owner's choice, 2026-10-28).
      disableSessionRefresh: true,
    },
    advanced: { useSecureCookies: secureCookies },
    user: {
      additionalFields: {
        // Nobody can choose their own role: Better Auth ignores a role sent
        // when the user is created and refuses one sent in an update.
        role: { type: "string", input: false, defaultValue: "customer" },
      },
    },
    plugins: [
      phoneNumber({
        otpLength: LOGIN_RULES.codeLength,
        expiresIn: LOGIN_RULES.codeLifetimeSeconds,
        allowedAttempts: LOGIN_RULES.wrongTriesAllowed,
        phoneNumberValidator: isIndianMobileNumber,
        sendOTP: ({ phoneNumber: number, code }) => sendCode(number, code),
        signUpOnVerification: {
          // Better Auth requires an email. ".invalid" is a reserved domain:
          // nothing is ever delivered there.
          getTempEmail: (number) => `${number.replace(/\D/g, "")}@phone.invalid`,
          // The profile (task 21) asks for a name.
          getTempName: () => "",
        },
        callbackOnVerification: ({ user, phoneNumber: number }) => onVerified(user.id, number),
      }),
      // Must stay last: copies the cookies Better Auth sets into Next.js's
      // cookies() when a Server Action calls it.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
