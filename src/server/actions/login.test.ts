import { headers } from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { initialLoginState, type LoginState } from "@/lib/login-state";
import type { Auth } from "@/server/auth/auth";
import { getAuth } from "@/server/auth/instance";
import { LoginServiceError, requestLoginCode, verifyLoginCode } from "@/server/auth/login";

import allMessages from "../../../messages/en.json";

import { loginStep, logOut } from "./login";

// The actions only translate: the login service (tested on its own) is
// replaced here, so each test sets the answer it needs.

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/auth/instance", () => ({ getAuth: vi.fn() }));
vi.mock("@/server/auth/login", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/login")>()),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
}));
vi.mock("@/server/env", () => ({
  serverEnv: () => ({
    appEnv: "staging",
    databaseUrl: "postgres://x",
    authSecret: "s".repeat(32),
    smsProvider: "fake",
    e2eOutboxFile: undefined,
  }),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Login" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = allMessages.Login;
const signOut = vi.fn();
const attemptId = "6f1c2a52-8a4c-4a35-9a43-0d8f0f5b3c11";
// 12:00:30 India time.
const resendAt = new Date("2026-10-28T06:30:30Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }));
  vi.mocked(getAuth).mockResolvedValue({ api: { signOut } } as unknown as Auth);
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const phoneStep = form({ intent: "send", phone: "98765 43210", age: "on", consent: "on" });
const codeStep: LoginState = {
  step: "code",
  phoneTyped: "98765 43210",
  ageConfirmed: true,
  contactConsent: true,
  attemptId,
  phoneDisplay: "+91 98765 43210",
  resendAt: resendAt.toISOString(),
};

/** What an action threw (a redirect is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

describe("loginStep: the phone step", () => {
  test("a code sent: the code step, the number as people read it, and when Resend opens", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: true,
      sent: true,
      attemptId,
      phoneNumber: "+919876543210",
      resendAt,
    });

    expect(await loginStep("en", initialLoginState, phoneStep)).toEqual({
      ...codeStep,
      status: "We sent a 6-digit code to +91 98765 43210.",
    });
    expect(requestLoginCode).toHaveBeenCalledWith(
      expect.anything(),
      {
        locale: "en",
        intent: "start",
        phoneTyped: "98765 43210",
        ageConfirmed: true,
        contactConsent: true,
        ipKey: "203.0.113.7",
      },
      expect.anything(),
    );
  });

  test("a code already sent says so, instead of 'we sent'", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: true,
      sent: false,
      attemptId,
      phoneNumber: "+919876543210",
      resendAt,
    });
    const state = await loginStep("en", initialLoginState, phoneStep);
    expect(state.status).toBe("We already sent a code to +91 98765 43210. It works for 5 minutes.");
  });

  test.each([
    ["invalidPhone", "phone", t.errors.invalidPhone],
    ["consentMissing", "consent", t.errors.consentMissing],
  ] as const)("%s: stays on the phone step, keeps what was typed, error on the %s field", async (problem, field, text) => {
    vi.mocked(requestLoginCode).mockResolvedValue({ ok: false, problem });
    const unticked = form({ intent: "send", phone: "12345", age: "on" });
    expect(await loginStep("en", initialLoginState, unticked)).toEqual({
      step: "phone",
      phoneTyped: "12345",
      ageConfirmed: true,
      contactConsent: false,
      error: { field, text },
    });
  });

  test("rateLimited names the time to try again, in India time", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: false,
      problem: "rateLimited",
      retryAt: new Date("2026-10-28T07:30:00Z"),
      attemptId,
      phoneNumber: "+919876543210",
    });
    const state = await loginStep("en", initialLoginState, phoneStep);
    expect(state.step).toBe("phone");
    expect(state.error).toEqual({
      field: "form",
      text: "Too many codes for this number. Try again after 1:00 pm, or call us.",
    });
  });

  test("tooSoon gives the moment to count down to", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: false,
      problem: "tooSoon",
      retryAt: resendAt,
      attemptId,
      phoneNumber: "+919876543210",
    });
    const state = await loginStep("en", initialLoginState, phoneStep);
    expect(state).toMatchObject({ step: "phone", retryAt: resendAt.toISOString(), error: { field: "form" } });
  });
});

describe("loginStep: Send a new code", () => {
  test("sends with the attempt from the form, and keeps the code step", async () => {
    const newResendAt = new Date("2026-10-28T06:31:30Z");
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: true,
      sent: true,
      attemptId: "a9f6c0d4-1111-4222-8333-444455556666",
      phoneNumber: "+919876543210",
      resendAt: newResendAt,
    });
    const state = await loginStep("en", codeStep, form({ intent: "resend", attemptId }));
    expect(requestLoginCode).toHaveBeenCalledWith(
      expect.anything(),
      { locale: "en", intent: "resend", attemptId, ipKey: "203.0.113.7" },
      expect.anything(),
    );
    expect(state).toMatchObject({
      step: "code",
      attemptId: "a9f6c0d4-1111-4222-8333-444455556666",
      resendAt: newResendAt.toISOString(),
    });
  });

  test("startOver goes back to an empty phone step with the message", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({ ok: false, problem: "startOver" });
    expect(await loginStep("en", codeStep, form({ intent: "resend", attemptId }))).toEqual({
      ...initialLoginState,
      error: { field: "form", text: t.errors.startOver },
    });
  });
});

describe("loginStep: the code step", () => {
  test("the right code redirects to /account, replacing the login page in the history", async () => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: true });
    const error = await thrownBy(loginStep("en", codeStep, form({ intent: "verify", attemptId, code: "123 456" })));
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/account;/) });
    expect(verifyLoginCode).toHaveBeenCalledWith(
      expect.anything(),
      { locale: "en", attemptId, codeTyped: "123 456" },
      expect.any(Headers),
    );
  });

  test.each([
    ["wrongCode", t.errors.wrongCode],
    ["invalidCode", t.errors.invalidCode],
  ] as const)("%s: stays on the code step with the error on the code field", async (problem, text) => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: false, problem });
    expect(await loginStep("en", codeStep, form({ intent: "verify", attemptId, code: "000000" }))).toEqual({
      ...codeStep,
      error: { field: "code", text },
    });
  });

  test("tooManyTries opens Resend at once", async () => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: false, problem: "tooManyTries" });
    // Resend would still be far off without the change.
    const waiting = { ...codeStep, resendAt: new Date("2099-01-01T00:00:00Z").toISOString() };
    const state = await loginStep("en", waiting, form({ intent: "verify", attemptId, code: "000000" }));
    expect(state.error).toEqual({ field: "code", text: t.errors.tooManyTries });
    expect(state.resendAt).toBe(new Date(0).toISOString());
  });
});

describe("loginStep: what it refuses or passes on", () => {
  test("an unknown locale throws before anything else runs", async () => {
    await expect(loginStep("xx", initialLoginState, phoneStep)).rejects.toThrow("Unknown locale");
    expect(requestLoginCode).not.toHaveBeenCalled();
    expect(getAuth).not.toHaveBeenCalled();
  });

  test("an unexpected service error is thrown on, not turned into a message", async () => {
    const failure = new LoginServiceError("requestLoginCode", "DrizzleQueryError 57P01");
    vi.mocked(requestLoginCode).mockRejectedValue(failure);
    await expect(loginStep("en", initialLoginState, phoneStep)).rejects.toBe(failure);
  });
});

describe("logOut", () => {
  test("signs out with the request's headers, then goes to the home page", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session_token=abc" });
    vi.mocked(headers).mockResolvedValue(requestHeaders);
    const error = await thrownBy(logOut("en"));
    expect(signOut).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/;/) });
  });
});
