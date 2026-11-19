import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { readMyProfile } from "@/server/dal/profile";
import { readMyReviewTarget } from "@/server/dal/reviews";
import messages from "../../../../../../../messages/en.json";

import { ReviewGate, type ReviewGateProps } from "./review-gate";

// ReviewGate is an async Server Component: each test calls it and renders
// what it returns. The session, the profile, the booking read and the action
// are stand-ins; the form is the real one (review-form.test.tsx tests it).
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));
vi.mock("@/server/dal/reviews", () => ({ readMyReviewTarget: vi.fn() }));
vi.mock("@/server/actions/reviews", () => ({ sendReview: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "ReviewPage" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.ReviewPage;
const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const BOOKING = "11111111-2222-4333-8444-555555555555";

const props: ReviewGateProps = {
  locale: "en",
  bookingId: BOOKING,
  labels: {
    ratingLegend: t.ratingLegend,
    starLabels: { 1: "1 out of 5 stars", 2: "2 out of 5 stars", 3: "3 out of 5 stars", 4: "4 out of 5 stars", 5: "5 out of 5 stars" },
    commentLabel: t.commentLabel,
    commentHint: t.commentHint,
    commentCount: t.commentCount,
    submit: t.submit,
    sending: t.sending,
    connection: t.connection,
    thanksHeading: t.thanksHeading,
    thanksBody: t.thanksBody,
    seeReviews: t.seeReviews,
    back: t.back,
  },
};

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
  vi.mocked(readMyReviewTarget).mockResolvedValue({
    status: "can-review",
    bookingId: BOOKING,
    kind: "car",
    makeName: { en: "Honda" },
    shownName: "Asha",
  });
});

describe("ReviewGate", () => {
  test("logged out (a leftover cookie): to /login?session=ended, before the booking is read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(ReviewGate(props))).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/login\?session=ended;/) });
    expect(readMyReviewTarget).not.toHaveBeenCalled();
  });

  test("no name yet: a link to /account", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    renderWithIntl(await ReviewGate(props));
    expect(screen.getByRole("link", { name: messages.EstimatePage.nameLink }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  test("not the customer's completed job: a note and a way back, no form", async () => {
    vi.mocked(readMyReviewTarget).mockResolvedValue({ status: "not-found" });
    renderWithIntl(await ReviewGate(props));
    expect(screen.getByText(t.notFound)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.back }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  test("already reviewed: its stars, no form", async () => {
    vi.mocked(readMyReviewTarget).mockResolvedValue({ status: "already-reviewed", bookingId: BOOKING, rating: 4 });
    renderWithIntl(await ReviewGate(props));
    expect(screen.getByText("You've already reviewed this job: 4 out of 5.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  test("a completed job: the form, with the vehicle, the credit it will be shown under and the public note's privacy link", async () => {
    renderWithIntl(await ReviewGate(props));
    expect(screen.getByText("Your Honda car")).toBeTruthy();
    expect(screen.getByText("Shown as: Asha, Honda car")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "privacy notice" }).getAttribute("href")).toBe("/privacy");
    expect(readMyReviewTarget).toHaveBeenCalledWith(BOOKING);
  });
});
