import { act, fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import type { ReviewFormState } from "@/lib/review-form";
import messages from "../../../messages/en.json";

import { type ReviewAction, ReviewForm, type ReviewFormLabels } from "./review-form";

// The form's words come from the page as props: here, the real messages. The
// Server Action is a stand-in answering what each test needs
// (src/server/actions/reviews.test.ts tests the real one).

beforeEach(() => {
  vi.clearAllMocks();
});

const t = messages.ReviewPage;
const labels: ReviewFormLabels = {
  ratingLegend: t.ratingLegend,
  starLabels: { 1: "1 out of 5 stars", 2: "2 out of 5 stars", 3: "3 out of 5 stars", 4: "4 out of 5 stars", 5: "5 out of 5 stars" },
  commentLabel: t.commentLabel,
  commentHint: t.commentHint,
  commentCount: t.commentCount,
  creditPreview: "Shown as: Asha, Honda car",
  submit: t.submit,
  sending: t.sending,
  connection: t.connection,
  thanksHeading: t.thanksHeading,
  thanksBody: t.thanksBody,
  seeReviews: t.seeReviews,
  back: t.back,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLIC_NOTE = "Shown publicly as soon as you send it.";

function form(action: ReviewAction) {
  return <ReviewForm action={action} labels={labels} publicNote={PUBLIC_NOTE} />;
}

function formIn(mode: "visible" | "hidden", action: ReviewAction) {
  return <Activity mode={mode}>{form(action)}</Activity>;
}

function withIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      {ui}
    </NextIntlClientProvider>
  );
}

const comment = () => screen.getByLabelText(t.commentLabel) as HTMLTextAreaElement;
const star = (n: number) => screen.getByRole("radio", { name: `${n} out of 5 stars` }) as HTMLInputElement;

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.submit }));
  });
}

function posted(action: ReturnType<typeof vi.fn<ReviewAction>>, call = 0) {
  return Object.fromEntries(action.mock.calls[call]![1].entries());
}

const withErrors: ReviewFormState = {
  submission: 1,
  values: { rating: "", comment: "Good" },
  errors: { rating: t.errors["rating-missing"] },
  sent: false,
};

describe("ReviewForm", () => {
  test("the stars, the comment with its hint and count, the credit preview and the public note", () => {
    renderWithIntl(form(vi.fn<ReviewAction>()));
    expect(screen.getByRole("group", { name: t.ratingLegend })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(comment().required).toBe(false);
    expect(comment().maxLength).toBe(-1);
    expect(screen.getByText(t.commentHint)).toBeTruthy();
    expect(screen.getByText("0 of 1000 characters")).toBeTruthy();
    fireEvent.change(comment(), { target: { value: "  🚗 ok " } });
    expect(screen.getByText("4 of 1000 characters")).toBeTruthy();
    expect(screen.getByText("Shown as: Asha, Honda car")).toBeTruthy();
    expect(screen.getByText(PUBLIC_NOTE)).toBeTruthy();
  });

  test("sends the stars, the comment and a request token; a retry reuses the token", async () => {
    const action = vi.fn<ReviewAction>().mockResolvedValue(withErrors);
    renderWithIntl(form(action));
    fireEvent.click(star(4));
    fireEvent.change(comment(), { target: { value: "Good" } });
    await submit();
    expect(posted(action)).toMatchObject({ rating: "4", comment: "Good" });
    expect(posted(action).requestToken).toMatch(UUID);
    await submit();
    expect(posted(action, 1).requestToken).toBe(posted(action).requestToken);
  });

  test("a missing rating: the error under the stars and the cursor on the first star, the comment kept", async () => {
    renderWithIntl(form(vi.fn<ReviewAction>().mockResolvedValue(withErrors)));
    fireEvent.change(comment(), { target: { value: "Good" } });
    await submit();
    expect(screen.getByText(t.errors["rating-missing"])).toBeTruthy();
    expect(comment().value).toBe("Good");
    expect(document.activeElement).toBe(star(1));
  });

  test("sent: the thank-you panel with links to the reviews and the account, and no form", async () => {
    renderWithIntl(form(vi.fn<ReviewAction>().mockResolvedValue({ ...withErrors, errors: {}, sent: true })));
    fireEvent.click(star(5));
    await submit();
    const panel = screen.getByRole("status");
    expect(within(panel).getByText(t.thanksHeading)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: t.seeReviews }).getAttribute("href")).toBe("/reviews");
    expect(within(panel).getByRole("link", { name: t.back }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
  });

  test("a failed call keeps everything and says so", async () => {
    renderWithIntl(form(vi.fn<ReviewAction>().mockRejectedValue(new TypeError("Failed to fetch"))));
    fireEvent.click(star(3));
    fireEvent.change(comment(), { target: { value: "Fine" } });
    await submit();
    expect(screen.getByText(t.connection)).toBeTruthy();
    expect(star(3).checked).toBe(true);
    expect(comment().value).toBe("Fine");
  });

  test("keeps a star tapped before the page's JavaScript loaded", async () => {
    const tree: ReactElement = withIntl(form(vi.fn<ReviewAction>()));
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    (within(container).getByRole("radio", { name: "4 out of 5 stars" }) as HTMLInputElement).checked = true;

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    try {
      expect(consoleError).not.toHaveBeenCalled();
      expect((within(container).getByRole("radio", { name: "4 out of 5 stars" }) as HTMLInputElement).checked).toBe(true);
    } finally {
      consoleError.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
  });

  test("leaving the page and coming back starts it empty, with a new token", async () => {
    const action = vi.fn<ReviewAction>().mockResolvedValue(withErrors);
    const { rerender } = renderWithIntl(formIn("visible", action));
    fireEvent.change(comment(), { target: { value: "Good" } });
    await submit();
    rerender(withIntl(formIn("hidden", action)));
    rerender(withIntl(formIn("visible", action)));
    expect(comment().value).toBe("");
    expect(screen.queryByText(t.errors["rating-missing"])).toBeNull();
    await submit();
    expect(posted(action, 1).requestToken).not.toBe(posted(action).requestToken);
  });
});
