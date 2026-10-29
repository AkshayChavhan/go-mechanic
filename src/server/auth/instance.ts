// The app's own Better Auth instance: one per process, built on first use.
//
// It needs the database, and getDatabase() is async, so the instance can't
// be made when this file loads. It's kept on globalThis, next to the
// database, so hot reloads under `npm run dev` reuse it. A change to the
// auth settings (auth.ts) therefore needs a dev-server restart. The store its
// callbacks read (loginRequest in login.ts) is on globalThis too, so edits to
// the login service itself work without one.

import "server-only";

import { getDatabase } from "@/server/db";
import { serverEnv } from "@/server/env";

import { type Auth, createAuth } from "./auth";
import { onVerifiedLogin, sendLoginCodeSms } from "./login";

const globalForAuth = globalThis as typeof globalThis & { appAuth?: Promise<Auth> };

async function buildAuth(): Promise<Auth> {
  const env = serverEnv();
  return createAuth({
    db: await getDatabase(),
    secret: env.authSecret,
    secureCookies: env.appEnv !== "local",
    sendCode: sendLoginCodeSms,
    onVerified: onVerifiedLogin,
  });
}

/** The app's Better Auth instance. A failed build isn't remembered: the next call tries again. */
export function getAuth(): Promise<Auth> {
  globalForAuth.appAuth ??= buildAuth().catch((error: unknown) => {
    globalForAuth.appAuth = undefined;
    throw error;
  });
  return globalForAuth.appAuth;
}
