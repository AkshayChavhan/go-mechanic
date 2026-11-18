// Login sessions, for what Better Auth doesn't do itself.

import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/server/db";
import { sessions } from "@/server/db/schema";

/**
 * Ends the login with this session token, if it still exists. Called only
 * by the login service when another login replaces it on the same phone
 * (verifyLoginCode), with a token from a cookie whose signature checked out.
 * It can't call authorize(): the new login's cookie isn't readable until the
 * next request. Nothing in it comes from a browser unchecked.
 */
export async function deleteSessionByToken(token: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(sessions).where(eq(sessions.token, token));
}
