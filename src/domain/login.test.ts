import { describe, expect, test } from "vitest";

import { decideSend, ipLimitKey, LOGIN_RULES, parseLoginCode, type SendHistory } from "./login";

// decideSend is pure: each test builds the history the database would hold
// and passes the moment to decide at. No clock, no database.

const now = new Date("2026-10-28T06:30:00Z");

/** `seconds` before (negative) or after `now`. */
const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const MINUTE = 60;
const HOUR = 60 * MINUTE;

const empty: SendHistory = { sentToNumber: [], sentFromIp: null, liveCode: null };
/** A code sent `secondsAgo` seconds ago, still in its 5 minutes, with all its tries. */
const liveSince = (secondsAgo: number): SendHistory["liveCode"] => ({
  expiresAt: at(-secondsAgo + LOGIN_RULES.codeLifetimeSeconds),
  triesLeft: LOGIN_RULES.wrongTriesAllowed,
});

describe("parseLoginCode (what someone typed as the code)", () => {
  test.each([
    ["six digits", "123456"],
    ["a space in the middle (pasted from the SMS)", "123 456"],
    ["a dash", "123-456"],
    ["Devanagari digits", "१२३४५६"],
  ])("reads %s as 123456", (_case, typed) => {
    expect(parseLoginCode(typed)).toBe("123456");
  });

  test.each([
    ["five digits", "12345"],
    ["seven digits", "1234567"],
    ["a letter", "12a456"],
    ["nothing", ""],
  ])("rejects %s", (_case, typed) => {
    expect(parseLoginCode(typed)).toBeNull();
  });
});

describe("decideSend (may a code be sent now?)", () => {
  test("a number with no history gets a code; Resend opens 30 seconds later", () => {
    for (const intent of ["start", "resend"] as const) {
      expect(decideSend(empty, intent, now)).toEqual({ outcome: "send", resendAt: at(30) });
    }
  });

  test("the phone step with a usable code sends nothing and goes to the code step", () => {
    const history = { ...empty, sentToNumber: [at(-10)], liveCode: liveSince(10) };
    expect(decideSend(history, "start", now)).toEqual({ outcome: "alreadySent", resendAt: at(20) });
  });

  test("the phone step a minute after a send, code still usable: already sent, Resend open now", () => {
    const history = { ...empty, sentToNumber: [at(-MINUTE)], liveCode: liveSince(MINUTE) };
    expect(decideSend(history, "start", now)).toEqual({ outcome: "alreadySent", resendAt: now });
  });

  test("Resend under 30 seconds after a send is too soon", () => {
    const history = { ...empty, sentToNumber: [at(-10)], liveCode: liveSince(10) };
    expect(decideSend(history, "resend", now)).toEqual({ outcome: "tooSoon", retryAt: at(20) });
  });

  test("Resend after 30 seconds sends a new code, even while the old one is usable", () => {
    const history = { ...empty, sentToNumber: [at(-31)], liveCode: liveSince(31) };
    expect(decideSend(history, "resend", now)).toEqual({ outcome: "send", resendAt: at(30) });
  });

  test("the phone step under 30 seconds after a send whose code is used up is too soon, not already sent", () => {
    const history = { ...empty, sentToNumber: [at(-10)], liveCode: { expiresAt: at(290), triesLeft: 0 } };
    expect(decideSend(history, "start", now)).toEqual({ outcome: "tooSoon", retryAt: at(20) });
  });

  test("a code with no tries left, or past its 5 minutes, isn't usable: the phone step sends a new one", () => {
    const usedUp = { ...empty, sentToNumber: [at(-MINUTE)], liveCode: { expiresAt: at(4 * MINUTE), triesLeft: 0 } };
    const expired = { ...empty, sentToNumber: [at(-6 * MINUTE)], liveCode: { expiresAt: at(-MINUTE), triesLeft: 3 } };
    expect(decideSend(usedUp, "start", now).outcome).toBe("send");
    expect(decideSend(expired, "start", now).outcome).toBe("send");
  });

  test("the 6th SMS to a number within an hour waits until the oldest of the five is an hour old", () => {
    const sends = [at(-50 * MINUTE), at(-40 * MINUTE), at(-30 * MINUTE), at(-20 * MINUTE), at(-10 * MINUTE)];
    expect(decideSend({ ...empty, sentToNumber: sends }, "resend", now)).toEqual({
      outcome: "rateLimited",
      retryAt: at(10 * MINUTE),
    });
  });

  test("a send exactly an hour ago no longer counts", () => {
    const sends = [at(-HOUR), at(-40 * MINUTE), at(-30 * MINUTE), at(-20 * MINUTE), at(-10 * MINUTE)];
    expect(decideSend({ ...empty, sentToNumber: sends }, "resend", now).outcome).toBe("send");
  });

  test("the 11th SMS to a number within a day waits for the daily limit", () => {
    // Ten sends, two hours apart: never five in one hour.
    const sends = Array.from({ length: 10 }, (_, index) => at(-(2 + index * 2) * HOUR));
    expect(decideSend({ ...empty, sentToNumber: sends }, "start", now)).toEqual({
      outcome: "rateLimited",
      retryAt: at(-20 * HOUR + 24 * HOUR),
    });
  });

  test("the 31st SMS from one IP within an hour is limited, whatever the number", () => {
    const fromIp = Array.from({ length: 30 }, (_, index) => at(-(index + 1) * MINUTE));
    expect(decideSend({ ...empty, sentFromIp: fromIp }, "start", now)).toEqual({
      outcome: "rateLimited",
      retryAt: at(-30 * MINUTE + HOUR),
    });
    expect(decideSend({ ...empty, sentFromIp: fromIp.slice(1) }, "start", now).outcome).toBe("send");
  });

  test("with no IP (local runs) only the number's limits apply", () => {
    expect(decideSend({ ...empty, sentFromIp: null }, "start", now).outcome).toBe("send");
  });

  test("when two limits apply, the later lift time wins", () => {
    const sends = [at(-50 * MINUTE), at(-40 * MINUTE), at(-30 * MINUTE), at(-20 * MINUTE), at(-10 * MINUTE)];
    const fromIp = Array.from({ length: 30 }, (_, index) => at(-(index + 1) * MINUTE));
    expect(decideSend({ ...empty, sentToNumber: sends, sentFromIp: fromIp }, "resend", now)).toEqual({
      outcome: "rateLimited",
      retryAt: at(30 * MINUTE),
    });
  });
});

describe("ipLimitKey (what an IP address is limited by)", () => {
  test.each([
    ["IPv4", "203.0.113.7", "203.0.113.7"],
    ["IPv4 with spaces", " 203.0.113.7 ", "203.0.113.7"],
    ["IPv4 written as IPv6", "::ffff:203.0.113.7", "203.0.113.7"],
    ["IPv6, by its /64", "2001:db8:abcd:12:1:2:3:4", "2001:db8:abcd:12::/64"],
    ["another address in the same /64", "2001:0db8:abcd:0012:ffff:ffff:ffff:ffff", "2001:db8:abcd:12::/64"],
    ["shortened IPv6", "2001:db8::1", "2001:db8:0:0::/64"],
    ["upper-case IPv6", "2001:DB8:ABCD:12::1", "2001:db8:abcd:12::/64"],
  ])("%s", (_case, address, key) => {
    expect(ipLimitKey(address)).toBe(key);
  });

  test.each([["not an address", "unknown"], ["a bad IPv4", "300.1.1.1"], ["two ::", "1::2::3"], ["empty", ""]])(
    "rejects %s",
    (_case, address) => {
      expect(ipLimitKey(address)).toBeNull();
    },
  );
});
