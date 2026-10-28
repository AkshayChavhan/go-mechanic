// What the login service reads and writes about codes: the login attempts
// (one per "send me a code" request, with the consent given on that form)
// and Better Auth's stored codes (the verifications table).

import "server-only";

import { and, desc, eq, gt, lt, sql } from "drizzle-orm";

import { decideSend, LOGIN_RULES, type SendDecision, type SendIntent } from "@/domain/login";
import { getDatabase } from "@/server/db";
import { loginAttempts, verifications } from "@/server/db/schema";

export type LoginAttempt = typeof loginAttempts.$inferSelect;

/** What the person gave on the form: the language and their consent. */
export type AttemptConsent = Pick<LoginAttempt, "locale" | "noticeVersion" | "consentGivenAt">;

const HOUR = 60 * 60 * 1000;

type Reader = Pick<Awaited<ReturnType<typeof getDatabase>>, "select">;

/**
 * The number's newest stored code: when it expires and how many wrong tries
 * it has left, or null when there is none. Better Auth stores
 * "<code>:<wrong tries>" (pinned by src/server/auth/auth.test.ts).
 */
export async function readLiveCode(
  phoneNumber: string,
  db: Reader | undefined = undefined,
): Promise<{ expiresAt: Date; triesLeft: number } | null> {
  const reader = db ?? (await getDatabase());
  const [row] = await reader
    .select({ value: verifications.value, expiresAt: verifications.expiresAt })
    .from(verifications)
    .where(eq(verifications.identifier, phoneNumber))
    .orderBy(desc(verifications.createdAt))
    .limit(1);
  if (!row) return null;
  const tries = Number(row.value.split(":")[1] ?? 0);
  const used = Number.isSafeInteger(tries) && tries > 0 ? tries : 0;
  return { expiresAt: row.expiresAt, triesLeft: Math.max(0, LOGIN_RULES.wrongTriesAllowed - used) };
}

export type AttemptRequest = AttemptConsent & {
  phoneNumber: string;
  /** The IP's limit key (ipLimitKey), or null when it isn't known. */
  ipKey: string | null;
  intent: SendIntent;
  now: Date;
};

/**
 * Decides whether a code may be sent (decideSend) and records the attempt,
 * in one transaction that first locks the number (and the IP). So two
 * requests at the same moment are decided one after the other, and a burst
 * can't slip past the limits. Also deletes attempts older than 48 hours.
 *
 * The SMS itself is sent after this returns, outside the transaction: PGlite
 * has one connection, and the transaction holds it until it ends.
 */
export async function decideAndRecordAttempt(
  request: AttemptRequest,
): Promise<{ decision: SendDecision; attemptId: string }> {
  const { phoneNumber, ipKey, intent, now, locale, noticeVersion, consentGivenAt } = request;
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    // Waits for any other transaction holding the same lock; released when
    // this transaction ends. Always the number first, then the IP, so two
    // requests can never wait for each other.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`login-number:${phoneNumber}`}))`);
    if (ipKey) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`login-ip:${ipKey}`}))`);

    const dayAgo = new Date(now.getTime() - 24 * HOUR);
    const hourAgo = new Date(now.getTime() - HOUR);
    const toNumber = await tx
      .select({ createdAt: loginAttempts.createdAt })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.phoneNumber, phoneNumber),
          eq(loginAttempts.smsSent, true),
          gt(loginAttempts.createdAt, dayAgo),
        ),
      );
    const fromIp = ipKey
      ? await tx
          .select({ createdAt: loginAttempts.createdAt })
          .from(loginAttempts)
          .where(
            and(
              eq(loginAttempts.ipAddress, ipKey),
              eq(loginAttempts.smsSent, true),
              gt(loginAttempts.createdAt, hourAgo),
            ),
          )
      : null;
    const decision = decideSend(
      {
        sentToNumber: toNumber.map((row) => row.createdAt),
        sentFromIp: fromIp && fromIp.map((row) => row.createdAt),
        liveCode: await readLiveCode(phoneNumber, tx),
      },
      intent,
      now,
    );

    await tx
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, new Date(now.getTime() - LOGIN_RULES.keepRecordsHours * HOUR)));
    const [attempt] = await tx
      .insert(loginAttempts)
      .values({
        phoneNumber,
        ipAddress: ipKey,
        locale,
        noticeVersion,
        consentGivenAt,
        // Counted by the limits from now on: the send happens right after.
        smsSent: decision.outcome === "send",
        createdAt: now,
      })
      .returning({ id: loginAttempts.id });
    return { decision, attemptId: attempt.id };
  });
}

/** A login attempt by its id, or null (unknown, or deleted after 48 hours). */
export async function findLoginAttempt(attemptId: string): Promise<LoginAttempt | null> {
  // Ids are UUIDs: anything else (a tampered form) can't match, and would
  // make Postgres throw.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) return null;
  const db = await getDatabase();
  const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.id, attemptId)).limit(1);
  return attempt ?? null;
}

/**
 * After an SMS failed: the attempt no longer counts towards the limits, and
 * the number's stored codes go, so the next request sends a new one instead
 * of waiting 5 minutes for a code that never arrived.
 */
export async function forgetFailedSend(attemptId: string, phoneNumber: string): Promise<void> {
  const db = await getDatabase();
  await db.update(loginAttempts).set({ smsSent: false }).where(eq(loginAttempts.id, attemptId));
  await db.delete(verifications).where(eq(verifications.identifier, phoneNumber));
}
