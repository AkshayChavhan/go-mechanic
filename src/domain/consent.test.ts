import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

import { LOGIN_NOTICE_VERSION, noticeDate, PRIVACY_NOTICE_VALUES } from "./consent";

// Every consent record keeps the notice version it was given under, so the
// version must change whenever the words people agree to change. This test
// keeps a copy of the words for each version: edit the words in
// messages/en.json without bumping LOGIN_NOTICE_VERSION (and adding a copy
// here) and it fails.
//
// Since task 19 the short notice links the full privacy notice (/privacy),
// so its wording is part of what people agree to as well, with the numbers
// it states (PRIVACY_NOTICE_VALUES: how long things are kept). Both are
// pinned by one SHA-256 fingerprint of the PrivacyPage messages (without the
// page title and description) and those numbers, because a full copy would
// be a page long.

type Login = { ageLabel: string; consentLabel: string; notice: string };
type Pinned = Login & { privacyNotice: string | null };

const WORDING_BY_VERSION: Record<string, Pinned> = {
  "2026-10-28": {
    ageLabel: "I am 18 or older.",
    consentLabel:
      "I agree that {brand} can use my mobile number to log me in and to contact me by SMS, WhatsApp or phone about my bookings.",
    notice:
      "We keep your mobile number and when you agreed. We use it only to log you in and to tell you about your bookings. To stop this or delete your data, call the garage.",
    // There was no full privacy notice yet.
    privacyNotice: null,
  },
  "2026-10-29": {
    ageLabel: "I am 18 or older.",
    consentLabel:
      "I agree that {brand} can use my mobile number to log me in and to contact me by SMS, WhatsApp or phone about my bookings.",
    notice:
      "We keep your mobile number, when you agreed, and your device's network address (IP address) and browser type. We use them only to log you in, to keep logins safe and to tell you about your bookings. The <privacy>privacy notice</privacy> has the details. To stop this or delete your data, call the garage.",
    privacyNotice: "1982199cf6ba621f4e10c1877da221df54b5ae4275d6943db594bc19ef673a06",
  },
};

type Values = Record<string, Record<string, number>>;

/** A fingerprint of the privacy notice: its wording (but its page title and description) and the numbers it states. */
function fingerprint(privacy: Record<string, unknown>, values: Values): string {
  const wording = Object.fromEntries(
    Object.entries(privacy).filter(([key]) => key !== "metaTitle" && key !== "metaDescription"),
  );
  return createHash("sha256").update(JSON.stringify({ wording, values })).digest("hex");
}

/** The words consent depends on: the login's three, and the privacy notice's fingerprint. */
function wordingIn(login: Login, privacy: Record<string, unknown>, values: Values): Pinned {
  return {
    ageLabel: login.ageLabel,
    consentLabel: login.consentLabel,
    notice: login.notice,
    privacyNotice: fingerprint(privacy, values),
  };
}

function checkWording(login: Login, privacy: Record<string, unknown>, values: Values = PRIVACY_NOTICE_VALUES): void {
  const pinned = WORDING_BY_VERSION[LOGIN_NOTICE_VERSION];
  if (!pinned) throw new Error(`No copy of the wording for ${LOGIN_NOTICE_VERSION}: add one to consent.test.ts`);
  expect(
    wordingIn(login, privacy, values),
    "The consent wording or the privacy notice changed: bump LOGIN_NOTICE_VERSION in src/domain/consent.ts and add the new words (and the notice's new fingerprint) here",
  ).toEqual(pinned);
}

describe("the login notice version", () => {
  test("the English wording and the privacy notice are the ones pinned for the current version", () => {
    checkWording(messages.Login, messages.PrivacyPage);
  });

  test("changing one word of the short notice without bumping the version fails", () => {
    const edited = { ...messages.Login, notice: messages.Login.notice.replace("only", "mostly") };
    expect(() => checkWording(edited, messages.PrivacyPage)).toThrow("bump LOGIN_NOTICE_VERSION");
  });

  test("changing the privacy notice without bumping the version fails", () => {
    const edited = { ...messages.PrivacyPage, intro: `${messages.PrivacyPage.intro} Changed.` };
    expect(() => checkWording(messages.Login, edited)).toThrow("bump LOGIN_NOTICE_VERSION");
  });

  test("changing a number the privacy notice states (a login rule) without bumping the version fails", () => {
    const longer = { ...PRIVACY_NOTICE_VALUES, attempts: { hours: 72 } };
    expect(() => checkWording(messages.Login, messages.PrivacyPage, longer)).toThrow("bump LOGIN_NOTICE_VERSION");
  });

  test("the version is a YYYY-MM-DD date, maybe with a same-day suffix, because /privacy shows its date", () => {
    expect(LOGIN_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/);
    expect(Number.isNaN(new Date(noticeDate()).getTime())).toBe(false);
  });

  test("a second change on the same day keeps the date /privacy shows", () => {
    expect(noticeDate("2026-10-29")).toBe("2026-10-29");
    expect(noticeDate("2026-10-29.2")).toBe("2026-10-29");
  });

  test("the privacy page's title and description can change without a new version", () => {
    const edited = { ...messages.PrivacyPage, metaTitle: "Another title" };
    expect(() => checkWording(messages.Login, edited)).not.toThrow();
  });
});
