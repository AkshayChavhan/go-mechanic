import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

import { LOGIN_NOTICE_VERSION } from "./consent";

// Every consent record keeps the notice version it was given under, so the
// version must change whenever the words people agree to change. This test
// keeps a copy of the words for the current version: edit the words in
// messages/en.json without bumping LOGIN_NOTICE_VERSION (and this copy) and
// it fails.

const WORDING_BY_VERSION: Record<string, { ageLabel: string; consentLabel: string; notice: string }> = {
  "2026-10-28": {
    ageLabel: "I am 18 or older.",
    consentLabel:
      "I agree that {brand} can use my mobile number to log me in and to contact me by SMS, WhatsApp or phone about my bookings.",
    notice:
      "We keep your mobile number and when you agreed. We use it only to log you in and to tell you about your bookings. To stop this or delete your data, call the garage.",
  },
};

/** The words in a messages file that consent depends on. */
function wordingIn(login: { ageLabel: string; consentLabel: string; notice: string }) {
  return { ageLabel: login.ageLabel, consentLabel: login.consentLabel, notice: login.notice };
}

function checkWording(login: { ageLabel: string; consentLabel: string; notice: string }): void {
  const pinned = WORDING_BY_VERSION[LOGIN_NOTICE_VERSION];
  if (!pinned) throw new Error(`No copy of the wording for ${LOGIN_NOTICE_VERSION}: add one to consent.test.ts`);
  expect(
    wordingIn(login),
    "The consent wording changed: bump LOGIN_NOTICE_VERSION in src/domain/consent.ts and add the new words here",
  ).toEqual(pinned);
}

describe("the login notice version", () => {
  test("the English wording is the one pinned for the current version", () => {
    checkWording(messages.Login);
  });

  test("changing one word without bumping the version fails", () => {
    const edited = { ...messages.Login, notice: messages.Login.notice.replace("only", "mostly") };
    expect(() => checkWording(edited)).toThrow("bump LOGIN_NOTICE_VERSION");
  });
});
