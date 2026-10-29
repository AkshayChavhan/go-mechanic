// What a person agrees to when they log in, kept as proof under India's data
// protection law (the DPDP Act 2023): who agreed, to what, under which
// version of the notice, and when.

import { LOGIN_RULES } from "./login";

/**
 * The two boxes on the login page, one consent record each:
 * - "age_18_plus": "I am 18 or older."
 * - "account_and_booking_contact": the garage may use the mobile number to
 *   log the person in and to contact them about their bookings.
 */
export const CONSENT_PURPOSES = ["age_18_plus", "account_and_booking_contact"] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/**
 * Which wording of the login notice and boxes people saw. Change it whenever
 * the words change (consent.test.ts fails until you do): every consent
 * record keeps the version it was given under. Since task 19 the short
 * notice links the full privacy notice (/privacy), whose wording is part of
 * what people agree to: consent.test.ts pins both, and /privacy shows this
 * version as its "last updated" date, so it must stay a "YYYY-MM-DD" date.
 */
export const LOGIN_NOTICE_VERSION = "2026-10-29";

/**
 * The numbers the privacy notice states (how long things are kept), taken
 * from the rules the login runs on. They're part of what people agree to,
 * so consent.test.ts pins them with the notice's wording: change a login
 * rule the notice mentions and the test fails until the version moves.
 */
export const PRIVACY_NOTICE_VALUES = {
  attempts: { hours: LOGIN_RULES.keepRecordsHours },
  codes: { minutes: LOGIN_RULES.codeLifetimeSeconds / 60 },
  session: { days: LOGIN_RULES.sessionDays },
} as const;
