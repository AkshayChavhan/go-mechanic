// The login service: sending a code and checking it, with our limits and
// consent records around Better Auth. The Server Actions
// (src/server/actions/login.ts) call it; nothing else should.
//
//   requestLoginCode  the phone step and "Send a new code": check what was
//                     typed, decide (limits, a code still usable?), record
//                     the attempt with its consent, then let Better Auth make
//                     and send the code.
//   verifyLoginCode   the code step: let Better Auth check the code; just
//                     before it creates the session, the attempt's consent is
//                     copied into the consents table, or the login fails.
//
// Better Auth calls back into two functions here (sendLoginCodeSms and
// recordConsentsForVerifiedLogin, wired up in instance.ts). They need to know
// which request they belong to (its language, its login attempt), so the
// service runs Better Auth inside `loginRequest`, an AsyncLocalStorage: a
// value that follows one chain of async calls. Outside requestLoginCode and
// verifyLoginCode both refuse to work, so nothing else can send a code or
// sign someone in.
//
// Errors: the problems people can fix come back as codes (LoginProblem).
// Anything unexpected is thrown again without its details (see
// `withoutDetails`): database errors carry the query's values, and Next.js
// logs thrown errors.

import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { unstable_rethrow } from "next/navigation";

import { LOGIN_NOTICE_VERSION } from "@/domain/consent";
import { ipLimitKey, parseLoginCode, type SendIntent } from "@/domain/login";
import type { Locale } from "@/i18n/config";
import type { Clock } from "@/lib/clock";
import { parseIndianMobile } from "@/lib/contact-links";
import { recordLoginConsents } from "@/server/dal/consents";
import {
  type AttemptConsent,
  decideAndRecordAttempt,
  findLoginAttempt,
  forgetFailedSend,
  type LoginAttempt,
  readLiveCode,
} from "@/server/dal/login-codes";
import type { AppEnv } from "@/server/env";
import { smsProvider } from "@/server/providers/sms";

import type { Auth } from "./auth";
import { loginCodeText } from "./login-code-text";

/** What went wrong, for the form to explain. */
export type LoginProblem =
  | "invalidPhone"
  | "consentMissing"
  | "tooSoon"
  | "rateLimited"
  | "invalidCode"
  | "wrongCode"
  | "tooManyTries"
  | "startOver";

export type RequestCodeInput = {
  locale: Locale;
  intent: SendIntent;
  /** The phone step: what was typed, and the two boxes. */
  phoneTyped?: string;
  ageConfirmed?: boolean;
  contactConsent?: boolean;
  /** "Send a new code": the attempt the code step belongs to. */
  attemptId?: string;
  /** The IP's limit key (clientIpKey), or null. */
  ipKey: string | null;
};

export type RequestCodeResult =
  /** Go to (or stay on) the code step. `sent` is false when a usable code was already sent. */
  | { ok: true; sent: boolean; attemptId: string; phoneNumber: string; resendAt: Date }
  | { ok: false; problem: "invalidPhone" | "consentMissing" | "startOver" }
  | { ok: false; problem: "tooSoon" | "rateLimited"; retryAt: Date; attemptId: string; phoneNumber: string };

export type VerifyCodeInput = { locale: Locale; attemptId: string; codeTyped: string };

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; problem: "invalidCode" | "wrongCode" | "tooManyTries" | "startOver" };

type LoginRequest = { locale: Locale; attempt?: LoginAttempt };

const loginRequest = new AsyncLocalStorage<LoginRequest>();

// --- What Better Auth calls back -------------------------------------------

/** Better Auth's sendOTP: the SMS, in the language of the page that asked. */
export async function sendLoginCodeSms(phoneNumber: string, code: string): Promise<void> {
  const request = loginRequest.getStore();
  if (!request) throw new Error("Login codes are sent only through requestLoginCode");
  await smsProvider().send({ to: phoneNumber, text: await loginCodeText(request.locale, code) });
}

/**
 * Better Auth's callbackOnVerification: runs after a correct code, before
 * the session exists. No attempt for this number means no consent on
 * record, so the login fails (no session).
 */
export async function recordConsentsForVerifiedLogin(userId: string, phoneNumber: string): Promise<void> {
  const attempt = loginRequest.getStore()?.attempt;
  if (!attempt || attempt.phoneNumber !== phoneNumber) {
    throw new Error("A login needs the consent from its own login attempt");
  }
  await recordLoginConsents(userId, attempt);
}

// --- The service --------------------------------------------------------------

export async function requestLoginCode(
  auth: Auth,
  input: RequestCodeInput,
  clock: Clock,
): Promise<RequestCodeResult> {
  return withoutDetails("requestLoginCode", async () => {
    const now = clock.now();
    let phoneNumber: string;
    let consent: AttemptConsent;
    if (input.intent === "start") {
      const parsed = parseIndianMobile(input.phoneTyped ?? "");
      if (!parsed) return { ok: false, problem: "invalidPhone" };
      if (!input.ageConfirmed || !input.contactConsent) return { ok: false, problem: "consentMissing" };
      phoneNumber = parsed;
      consent = { locale: input.locale, noticeVersion: LOGIN_NOTICE_VERSION, consentGivenAt: now };
    } else {
      // "Send a new code" carries the consent of the attempt it belongs to.
      const previous = await findLoginAttempt(input.attemptId ?? "");
      if (!previous) return { ok: false, problem: "startOver" };
      phoneNumber = previous.phoneNumber;
      consent = previous;
    }

    const { decision, attemptId } = await decideAndRecordAttempt({
      phoneNumber,
      ipKey: input.ipKey,
      intent: input.intent,
      now,
      locale: input.locale,
      noticeVersion: consent.noticeVersion,
      consentGivenAt: consent.consentGivenAt,
    });

    switch (decision.outcome) {
      case "alreadySent":
        return { ok: true, sent: false, attemptId, phoneNumber, resendAt: decision.resendAt };
      case "tooSoon":
      case "rateLimited":
        return { ok: false, problem: decision.outcome, retryAt: decision.retryAt, attemptId, phoneNumber };
      case "send":
        try {
          await loginRequest.run({ locale: input.locale }, () =>
            auth.api.sendPhoneNumberOTP({ body: { phoneNumber } }),
          );
        } catch (error) {
          await forgetFailedSend(attemptId, phoneNumber);
          throw error;
        }
        return { ok: true, sent: true, attemptId, phoneNumber, resendAt: decision.resendAt };
    }
  });
}

/** Better Auth's answer when a code is wrong, gone or used up. */
function betterAuthCode(error: unknown): string | undefined {
  const code = (error as { body?: { code?: unknown } } | null)?.body?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Checks the code. On success Better Auth has created the session, and
 * (inside a Server Action) set its cookie through nextCookies().
 */
export async function verifyLoginCode(
  auth: Auth,
  input: VerifyCodeInput,
  requestHeaders: Headers,
): Promise<VerifyCodeResult> {
  return withoutDetails("verifyLoginCode", async () => {
    const code = parseLoginCode(input.codeTyped);
    if (!code) return { ok: false, problem: "invalidCode" };
    const attempt = await findLoginAttempt(input.attemptId);
    if (!attempt) return { ok: false, problem: "startOver" };

    try {
      await loginRequest.run({ locale: input.locale, attempt }, () =>
        auth.api.verifyPhoneNumber({ body: { phoneNumber: attempt.phoneNumber, code }, headers: requestHeaders }),
      );
      return { ok: true };
    } catch (error) {
      switch (betterAuthCode(error)) {
        case "INVALID_OTP":
          // Better Auth keeps a code after its third wrong try and refuses
          // it on the next one: say so now, so the person asks for a new code.
          return (await readLiveCode(attempt.phoneNumber))?.triesLeft === 0
            ? { ok: false, problem: "tooManyTries" }
            : { ok: false, problem: "wrongCode" };
        case "OTP_NOT_FOUND":
        case "OTP_EXPIRED":
          return { ok: false, problem: "wrongCode" };
        case "TOO_MANY_ATTEMPTS":
          return { ok: false, problem: "tooManyTries" };
        default:
          throw error;
      }
    }
  });
}

/**
 * The IP's limit key from the request headers, or null for local runs (no
 * proxy in front, so nothing trustworthy says who's connecting). On Vercel,
 * x-vercel-forwarded-for is the visitor's address; x-forwarded-for's first
 * entry is the fallback.
 */
export function clientIpKey(requestHeaders: Headers, appEnv: AppEnv): string | null {
  if (appEnv === "local") return null;
  const address =
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0] ?? requestHeaders.get("x-forwarded-for")?.split(",")[0];
  return address ? ipLimitKey(address) : null;
}

/** Thrown instead of an unexpected error: it names the step and the kind of error, nothing else. */
export class LoginServiceError extends Error {
  constructor(step: string, kind: string) {
    super(`${step} failed (${kind})`);
    this.name = "LoginServiceError";
  }
}

/** "DrizzleQueryError 23505": the error's name and, for a database error, its Postgres code. */
function kindOf(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const pgCode = (error.cause as { code?: unknown } | undefined)?.code ?? (error as { code?: unknown }).code;
  return typeof pgCode === "string" && /^[0-9A-Z]{5}$/.test(pgCode) ? `${error.name} ${pgCode}` : error.name;
}

/**
 * Runs a step and turns any unexpected error into a LoginServiceError with
 * no message or cause from the original: a database error's message holds
 * the query's values (numbers, codes, tokens), and Next.js logs thrown
 * errors. Next.js's own signals (redirects, notFound) pass through first.
 */
async function withoutDetails<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof LoginServiceError) throw error;
    throw new LoginServiceError(step, kindOf(error));
  }
}
