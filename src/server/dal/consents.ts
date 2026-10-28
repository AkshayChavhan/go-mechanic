// Consent records: proof of what each user agreed to (DPDP Act).

import "server-only";

import { CONSENT_PURPOSES } from "@/domain/consent";
import { getDatabase } from "@/server/db";
import { consents } from "@/server/db/schema";

import type { AttemptConsent } from "./login-codes";

/**
 * Records that `userId` gave every login consent, as given on the login
 * attempt: one row per purpose, at that notice version, language and time.
 * A row that already exists for the same purpose and version is kept as it
 * is (the first time counts). Throws if the rows can't be written.
 */
export async function recordLoginConsents(userId: string, attempt: AttemptConsent): Promise<void> {
  const db = await getDatabase();
  await db
    .insert(consents)
    .values(
      CONSENT_PURPOSES.map((purpose) => ({
        userId,
        purpose,
        noticeVersion: attempt.noticeVersion,
        locale: attempt.locale,
        givenAt: attempt.consentGivenAt,
      })),
    )
    .onConflictDoNothing({ target: [consents.userId, consents.purpose, consents.noticeVersion] });
}
