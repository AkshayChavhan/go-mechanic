import { inspect } from "node:util";

import { desc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { LOGIN_NOTICE_VERSION } from "@/domain/consent";
import { systemClock } from "@/lib/clock";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { consents, devMessages, loginAttempts, sessions, users, verifications } from "@/server/db/schema";
import { recordLoginConsents } from "@/server/dal/consents";
import { smsProvider } from "@/server/providers/sms";

import allMessages from "../../../messages/en.json";

import { type Auth, createAuth } from "./auth";
import {
  clientIpKey,
  LoginServiceError,
  recordConsentsForVerifiedLogin,
  requestLoginCode,
  type RequestCodeInput,
  sendLoginCodeSms,
  verifyLoginCode,
} from "./login";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The whole login against a real (in-memory) database: our service, Better
// Auth, the fake SMS provider writing dev_messages, and the consent records.
// Only the edges are replaced: getDatabase (this test's database), the
// settings, and next-intl's getTranslations (which needs a Next.js request).

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/env")>()),
  serverEnv: () => ({
    appEnv: "local",
    databaseUrl: undefined,
    authSecret: "test-secret-that-is-at-least-32-characters-long",
    smsProvider: "fake",
    e2eOutboxFile: undefined,
  }),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Sms" | "Brand" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});
// Real by default; single tests make them fail.
vi.mock("@/server/dal/consents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/dal/consents")>();
  return { recordLoginConsents: vi.fn(actual.recordLoginConsents) };
});
vi.mock("@/server/providers/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/providers/sms")>();
  return { smsProvider: vi.fn(actual.smsProvider) };
});

const number = "+919876543210";
const typed = "98765 43210";
const start = new Date("2026-10-28T06:30:00Z");

let db: Database;
let auth: Auth;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-characters-long",
    secureCookies: false,
    sendCode: sendLoginCodeSms,
    onVerified: recordConsentsForVerifiedLogin,
  });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  // Better Auth reads the time through Date, our service through the clock:
  // faking only Date moves both together. Timers stay real (PGlite needs them).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  for (const table of [consents, sessions, users, verifications, loginAttempts, devMessages]) await db.delete(table);
});
afterEach(() => {
  vi.useRealTimers();
});

/** `seconds` after the test started. */
const later = (seconds: number) => new Date(start.getTime() + seconds * 1000);
const moveTo = (seconds: number) => vi.setSystemTime(later(seconds));

function ask(input: Partial<RequestCodeInput> = {}) {
  return requestLoginCode(
    auth,
    { locale: "en", intent: "start", phoneTyped: typed, ageConfirmed: true, contactConsent: true, ipKey: null, ...input },
    systemClock,
  );
}

/** Asks for a code and returns the attempt id; fails the test unless the code step follows. */
async function askForCode(input: Partial<RequestCodeInput> = {}): Promise<string> {
  const result = await ask(input);
  if (!result.ok) throw new Error(`expected the code step, got ${result.problem}`);
  return result.attemptId;
}

function check(attemptId: string, codeTyped: string) {
  return verifyLoginCode(auth, { locale: "en", attemptId, codeTyped }, new Headers());
}

/**
 * The newest code the fake SMS provider stored for `recipient`. (With Date
 * faked, two SMS sent without moving the time have the same created_at, so
 * the recipient tells them apart.)
 */
async function latestCode(recipient = number): Promise<string> {
  const [row] = await db
    .select()
    .from(devMessages)
    .where(eq(devMessages.recipient, recipient))
    .orderBy(desc(devMessages.createdAt))
    .limit(1);
  const code = row && /^(\d{6}) /.exec(row.body)?.[1];
  if (!code) throw new Error(`no SMS was sent to ${recipient}`);
  return code;
}

/** A 6-digit code that isn't `code`. */
const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

describe("the whole login", () => {
  test("a new number: code by SMS, the right code signs in, consent recorded, one session", async () => {
    const result = await ask();
    expect(result).toEqual({
      ok: true,
      sent: true,
      attemptId: expect.any(String),
      phoneNumber: number,
      resendAt: later(30),
    });

    const [sms] = await db.select().from(devMessages);
    expect(sms).toMatchObject({ channel: "sms", recipient: number });
    expect(sms.body).toMatch(new RegExp(`^\\d{6} is your ${allMessages.Brand.name} login code\\. It works for 5 minutes\\.`));

    moveTo(20);
    if (!result.ok) throw new Error("unreachable");
    expect(await check(result.attemptId, (await latestCode()).replace(/^(\d{3})/, "$1 "))).toEqual({ ok: true });

    const [user] = await db.select().from(users);
    expect(user).toMatchObject({ phoneNumber: number, role: "customer" });
    expect(await db.$count(sessions)).toBe(1);
    const records = await db.select().from(consents).orderBy(consents.purpose);
    expect(records.map(({ purpose, noticeVersion, locale, givenAt, userId }) => ({
      purpose,
      noticeVersion,
      locale,
      givenAt,
      userId,
    }))).toEqual([
      // Postgres sorts an enum in the order its values were declared.
      { purpose: "age_18_plus", noticeVersion: LOGIN_NOTICE_VERSION, locale: "en", givenAt: start, userId: user.id },
      { purpose: "account_and_booking_contact", noticeVersion: LOGIN_NOTICE_VERSION, locale: "en", givenAt: start, userId: user.id },
    ]);
  });

  test("a returning user at the same notice version adds no consent rows", async () => {
    await check(await askForCode(), await latestCode());
    moveTo(10 * 60);
    expect(await check(await askForCode(), await latestCode())).toEqual({ ok: true });
    expect(await db.$count(consents)).toBe(2);
    expect(await db.$count(sessions)).toBe(2);
  });

  test("a login under newer wording adds rows for that version", async () => {
    await check(await askForCode(), await latestCode());
    moveTo(10 * 60);
    const attemptId = await askForCode();
    // As if the page had shown a newer notice when the boxes were ticked.
    await db.update(loginAttempts).set({ noticeVersion: "2099-01-01" }).where(eq(loginAttempts.id, attemptId));
    await check(attemptId, await latestCode());
    const versions = (await db.select().from(consents)).map((row) => row.noticeVersion).sort();
    expect(versions).toEqual([LOGIN_NOTICE_VERSION, LOGIN_NOTICE_VERSION, "2099-01-01", "2099-01-01"]);
  });
});

describe("asking for a code", () => {
  test("a number that isn't an Indian mobile: invalidPhone, nothing sent or recorded", async () => {
    expect(await ask({ phoneTyped: "020 2765 4321" })).toEqual({ ok: false, problem: "invalidPhone" });
    expect(await db.$count(loginAttempts)).toBe(0);
    expect(await db.$count(devMessages)).toBe(0);
  });

  test.each([
    { ageConfirmed: false, contactConsent: true },
    { ageConfirmed: true, contactConsent: false },
  ])("an unticked box ($ageConfirmed, $contactConsent): consentMissing, nothing sent", async (boxes) => {
    expect(await ask(boxes)).toEqual({ ok: false, problem: "consentMissing" });
    expect(await db.$count(loginAttempts)).toBe(0);
    expect(await db.$count(devMessages)).toBe(0);
  });

  test("the phone step again while the code is usable: no second SMS, same code step", async () => {
    await askForCode();
    moveTo(10);
    expect(await ask()).toEqual({ ok: true, sent: false, attemptId: expect.any(String), phoneNumber: number, resendAt: later(30) });
    expect(await db.$count(devMessages)).toBe(1);
  });

  test('"Send a new code" before 30 seconds is too soon; after, it sends a code that replaces the old one', async () => {
    const attemptId = await askForCode();
    const first = await latestCode();

    moveTo(10);
    expect(await ask({ intent: "resend", attemptId })).toEqual({
      ok: false,
      problem: "tooSoon",
      retryAt: later(30),
      attemptId: expect.any(String),
      phoneNumber: number,
    });

    moveTo(31);
    const resent = await ask({ intent: "resend", attemptId });
    expect(resent).toMatchObject({ ok: true, sent: true, resendAt: later(61) });
    let second = await latestCode();
    // One chance in a million that the new code equals the old one.
    while (second === first) {
      moveTo(70);
      await ask({ intent: "resend", attemptId });
      second = await latestCode();
    }
    if (!resent.ok) throw new Error("unreachable");
    expect(await check(resent.attemptId, first)).toEqual({ ok: false, problem: "wrongCode" });
    expect(await check(resent.attemptId, second)).toEqual({ ok: true });
    // The consent is the one given on the phone step (ticked at `start`),
    // carried by "Send a new code", not a new one at the resend's time.
    const givenAt = (await db.select().from(consents)).map((row) => row.givenAt.getTime());
    expect(givenAt).toEqual([start.getTime(), start.getTime()]);
  });

  test('"Send a new code" with an attempt that doesn\'t exist: startOver', async () => {
    expect(await ask({ intent: "resend", attemptId: "00000000-0000-4000-8000-000000000000" })).toEqual({
      ok: false,
      problem: "startOver",
    });
    expect(await ask({ intent: "resend", attemptId: "not-a-uuid" })).toEqual({ ok: false, problem: "startOver" });
  });

  test("the 6th SMS to a number within an hour is refused until the first is an hour old", async () => {
    const attemptId = await askForCode();
    for (let send = 1; send <= 4; send++) {
      moveTo(send * 60);
      expect(await ask({ intent: "resend", attemptId })).toMatchObject({ ok: true, sent: true });
    }
    moveTo(5 * 60);
    expect(await ask({ intent: "resend", attemptId })).toEqual({
      ok: false,
      problem: "rateLimited",
      retryAt: later(60 * 60),
      attemptId: expect.any(String),
      phoneNumber: number,
    });
    expect(await db.$count(devMessages)).toBe(5);
  });

  test("the 31st SMS from one IP within an hour is refused; without an IP nothing counts", async () => {
    const ipKey = "203.0.113.7";
    await db.insert(loginAttempts).values(
      Array.from({ length: 30 }, (_, index) => ({
        phoneNumber: `+9190000${String(index).padStart(5, "0")}`,
        ipAddress: ipKey,
        locale: "en",
        noticeVersion: LOGIN_NOTICE_VERSION,
        consentGivenAt: start,
        smsSent: true,
        createdAt: later(-60 * (index + 1)),
      })),
    );
    expect(await ask({ ipKey })).toMatchObject({ ok: false, problem: "rateLimited", retryAt: later(30 * 60) });
    expect(await ask({ ipKey: null })).toMatchObject({ ok: true, sent: true });
  });

  test("ten requests at the same moment send one SMS", async () => {
    // Each request decides and records in one transaction behind a lock on
    // the number, so they're decided one after the other. (PGlite runs one
    // transaction at a time anyway; the lock matters on a real Postgres.)
    const results = await Promise.all(Array.from({ length: 10 }, () => ask()));
    expect(await db.$count(devMessages)).toBe(1);
    expect(results.filter((result) => result.ok && result.sent)).toHaveLength(1);
  });

  test("when the SMS fails: the error has no details, the code is gone, and the next try sends", async () => {
    vi.mocked(smsProvider).mockReturnValueOnce({ send: () => Promise.reject(new Error(`SMS to ${number} failed`)) });
    const failure = await ask().then(
      () => "no error",
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(LoginServiceError);
    expect(inspect(failure)).not.toContain("9876543210");
    expect(await db.$count(verifications)).toBe(0);
    const [attempt] = await db.select().from(loginAttempts);
    expect(attempt.smsSent).toBe(false);

    expect(await ask()).toMatchObject({ ok: true, sent: true });
  });

  test("login attempts older than 48 hours are deleted when a new one is recorded", async () => {
    await db.insert(loginAttempts).values({
      phoneNumber: "+919000000001",
      ipAddress: null,
      locale: "en",
      noticeVersion: LOGIN_NOTICE_VERSION,
      consentGivenAt: start,
      createdAt: later(-49 * 3600),
    });
    await askForCode();
    expect((await db.select().from(loginAttempts)).map((row) => row.phoneNumber)).toEqual([number]);
  });
});

describe("checking a code", () => {
  test("a code that isn't 6 digits: invalidCode", async () => {
    expect(await check(await askForCode(), "12345")).toEqual({ ok: false, problem: "invalidCode" });
  });

  test("an unknown attempt: startOver, and nobody is signed in", async () => {
    await askForCode();
    expect(await check("00000000-0000-4000-8000-000000000000", await latestCode())).toEqual({
      ok: false,
      problem: "startOver",
    });
    expect(await db.$count(sessions)).toBe(0);
  });

  test("wrong codes: wrongCode twice, tooManyTries on the third, and then even the right code fails", async () => {
    const attemptId = await askForCode();
    const code = await latestCode();
    expect(await check(attemptId, wrongFor(code))).toEqual({ ok: false, problem: "wrongCode" });
    expect(await check(attemptId, wrongFor(code))).toEqual({ ok: false, problem: "wrongCode" });
    expect(await check(attemptId, wrongFor(code))).toEqual({ ok: false, problem: "tooManyTries" });
    expect(await check(attemptId, code)).toEqual({ ok: false, problem: "tooManyTries" });
    expect(await db.$count(sessions)).toBe(0);
  });

  test("after too many tries, the phone step sends a new code (after the 30-second wait)", async () => {
    const attemptId = await askForCode();
    const code = await latestCode();
    for (let tries = 0; tries < 3; tries++) await check(attemptId, wrongFor(code));
    moveTo(10);
    expect(await ask()).toMatchObject({ ok: false, problem: "tooSoon", retryAt: later(30) });
    moveTo(31);
    expect(await ask()).toMatchObject({ ok: true, sent: true });
  });

  test("an expired code: wrongCode, and a new request sends a new code", async () => {
    const attemptId = await askForCode();
    const code = await latestCode();
    moveTo(5 * 60 + 1);
    expect(await check(attemptId, code)).toEqual({ ok: false, problem: "wrongCode" });
    expect(await ask()).toMatchObject({ ok: true, sent: true });
  });

  test("my code with another number's attempt is checked against their number: wrongCode, nobody signed in", async () => {
    const theirs = await askForCode({ phoneTyped: "91234 56789" });
    await askForCode();
    const mine = await latestCode();
    let their = await latestCode("+919123456789");
    // One chance in a million that both numbers got the same code.
    if (their === mine) {
      moveTo(31);
      await ask({ intent: "resend", attemptId: theirs });
      their = await latestCode("+919123456789");
    }
    // The attempt decides the number: their attempt checks their code.
    expect(await check(theirs, mine)).toEqual({ ok: false, problem: "wrongCode" });
    expect(await db.$count(sessions)).toBe(0);
  });

  test("when the consent can't be recorded: an error without details, no session; the next login records it", async () => {
    vi.mocked(recordLoginConsents).mockRejectedValueOnce(
      Object.assign(new Error(`insert failed for ${number} with code 123456`), { name: "DrizzleQueryError" }),
    );
    const failure = await check(await askForCode(), await latestCode()).then(
      () => "no error",
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(LoginServiceError);
    expect(inspect(failure)).not.toMatch(/9876543210|123456/);
    expect(await db.$count(sessions)).toBe(0);
    expect(await db.$count(users)).toBe(1);

    moveTo(31);
    expect(await check(await askForCode(), await latestCode())).toEqual({ ok: true });
    expect(await db.$count(consents)).toBe(2);
  });

  test("a number with an account and one without get the same answers until the right code", async () => {
    const known = "+919000000002";
    await check(await askForCode({ phoneTyped: known }), await latestCode(known));
    moveTo(10 * 60);

    const answers = async (phoneTyped: string) => {
      const strip = (result: object) => ({ ...result, attemptId: "x", phoneNumber: "x" });
      const first = await ask({ phoneTyped });
      const again = await ask({ phoneTyped });
      if (!first.ok) throw new Error("expected a code");
      const wrong = await check(first.attemptId, "000000");
      return [strip(first), strip(again), wrong];
    };
    expect(await answers("90000 00002")).toEqual(await answers("90000 00003"));
  });
});

describe("what Better Auth calls back", () => {
  test("sending a code outside requestLoginCode is refused", async () => {
    await expect(sendLoginCodeSms(number, "123456")).rejects.toThrow("only through requestLoginCode");
  });

  test("a verified login outside verifyLoginCode records nothing and fails", async () => {
    await expect(recordConsentsForVerifiedLogin("user-1", number)).rejects.toThrow("its own login attempt");
  });
});

describe("clientIpKey (whose limit a request counts towards)", () => {
  test("local runs have no IP", () => {
    expect(clientIpKey(new Headers({ "x-forwarded-for": "203.0.113.7" }), "local")).toBeNull();
  });

  test("on Vercel, x-vercel-forwarded-for comes first", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" });
    expect(clientIpKey(headers, "staging")).toBe("203.0.113.7");
  });

  test("otherwise the first x-forwarded-for entry, IPv6 by its /64", () => {
    expect(clientIpKey(new Headers({ "x-forwarded-for": "2001:db8:1:2:3:4:5:6, 10.0.0.1" }), "production")).toBe(
      "2001:db8:1:2::/64",
    );
  });

  test("no header, or not an address: null", () => {
    expect(clientIpKey(new Headers(), "staging")).toBeNull();
    expect(clientIpKey(new Headers({ "x-forwarded-for": "unknown" }), "staging")).toBeNull();
  });
});
