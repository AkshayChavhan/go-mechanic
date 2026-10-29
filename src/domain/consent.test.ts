import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

import { LOGIN_NOTICE_VERSION } from "./consent";

// Every consent record keeps the notice version it was given under, so the
// version must change whenever the words people agree to change. This test
// keeps a copy of the words for each version: edit the words in
// messages/en.json without bumping LOGIN_NOTICE_VERSION (and adding a copy
// here) and it fails.
//
// Since task 19 the short notice links the full privacy notice (/privacy),
// so its wording is part of what people agree to as well. It's pinned by a
// SHA-256 fingerprint of the PrivacyPage messages (without the page title and
// description), because a full copy would be a page long.

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
    privacyNotice: "6feffe57e25b1d37c262bc56838e25e2d961d8a255ac1699eeabd5365a8eb5be",
  },
};

/** A fingerprint of the privacy notice's wording (everything but its page title and description). */
function fingerprint(privacy: Record<string, unknown>): string {
  const { metaTitle: _title, metaDescription: _description, ...wording } = privacy;
  return createHash("sha256").update(JSON.stringify(wording)).digest("hex");
}

/** The words consent depends on: the login's three, and the privacy notice's fingerprint. */
function wordingIn(login: Login, privacy: Record<string, unknown>): Pinned {
  return { ageLabel: login.ageLabel, consentLabel: login.consentLabel, notice: login.notice, privacyNotice: fingerprint(privacy) };
}

function checkWording(login: Login, privacy: Record<string, unknown>): void {
  const pinned = WORDING_BY_VERSION[LOGIN_NOTICE_VERSION];
  if (!pinned) throw new Error(`No copy of the wording for ${LOGIN_NOTICE_VERSION}: add one to consent.test.ts`);
  expect(
    wordingIn(login, privacy),
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

  test("the privacy page's title and description can change without a new version", () => {
    const edited = { ...messages.PrivacyPage, metaTitle: "Another title" };
    expect(() => checkWording(messages.Login, edited)).not.toThrow();
  });
});
