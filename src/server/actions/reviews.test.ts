import { beforeEach, describe, expect, test, vi } from "vitest";

import { initialReviewFormState } from "@/lib/review-form";
import { getCurrentUser } from "@/server/auth/session";
import { createMyReview } from "@/server/dal/reviews";

import allMessages from "../../../messages/en.json";

import { sendReview } from "./reviews";

// The action only checks, calls the data-access layer and translates. The
// save (tested on its own) is replaced here, so each test sets the answer it
// needs. requireUser is the real one, reading a mocked session.

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/reviews", () => ({ createMyReview: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "ReviewPage" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const BOOKING = "11111111-2222-4333-8444-555555555555";
const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";
const t = allMessages.ReviewPage;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(createMyReview).mockResolvedValue({ status: "sent", id: "r1" });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

const post = { rating: "4", comment: "Good work", requestToken: TOKEN };

describe("sendReview", () => {
  test("logged out: to /login, and nothing is saved", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(sendReview("en", BOOKING, initialReviewFormState, form(post)))).toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/),
    });
    expect(createMyReview).not.toHaveBeenCalled();
  });

  test("an unknown locale is refused before anything else", async () => {
    await expect(sendReview("xx", BOOKING, initialReviewFormState, form(post))).rejects.toThrow();
    expect(createMyReview).not.toHaveBeenCalled();
  });

  test("passes the bound booking and the posted fields; a sent review answers sent", async () => {
    const state = await sendReview("en", BOOKING, initialReviewFormState, form({ ...post, userId: "ravi" }));
    expect(createMyReview).toHaveBeenCalledWith({ bookingId: BOOKING, rating: "4", comment: "Good work", requestToken: TOKEN });
    expect(state).toEqual({ submission: 1, values: { rating: "4", comment: "Good work" }, errors: {}, sent: true });
  });

  test("a second send (duplicate) answers like the first", async () => {
    vi.mocked(createMyReview).mockResolvedValue({ status: "duplicate", id: "r1" });
    expect((await sendReview("en", BOOKING, initialReviewFormState, form(post))).sent).toBe(true);
  });

  test("not-found and already-reviewed are messages for the whole form", async () => {
    vi.mocked(createMyReview).mockResolvedValue({ status: "not-found" });
    expect((await sendReview("en", BOOKING, initialReviewFormState, form(post))).errors).toEqual({ form: t.errors["not-found"] });
    vi.mocked(createMyReview).mockResolvedValue({ status: "already-reviewed", id: "r1" });
    expect((await sendReview("en", BOOKING, initialReviewFormState, form(post))).errors).toEqual({
      form: t.errors["already-reviewed"],
    });
  });

  test("input problems map to their fields, keeping what was posted", async () => {
    vi.mocked(createMyReview).mockResolvedValue({
      status: "problems",
      problems: [
        { field: "rating", problem: "rating-missing" },
        { field: "comment", problem: "comment-too-long" },
      ],
    });
    const state = await sendReview("en", BOOKING, initialReviewFormState, form({ ...post, rating: "" }));
    expect(state).toMatchObject({
      sent: false,
      values: { rating: "", comment: "Good work" },
      errors: { rating: t.errors["rating-missing"], comment: t.errors["comment-too-long"] },
    });
  });

  test("no name yet: to /account", async () => {
    vi.mocked(createMyReview).mockResolvedValue({ status: "needs-name" });
    expect(await thrownBy(sendReview("en", BOOKING, initialReviewFormState, form(post)))).toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/account;/),
    });
  });
});
