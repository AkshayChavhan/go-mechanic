import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import type { CompletedJobRow } from "@/server/dal/reviews";
import messages from "../../../messages/en.json";

import { CompletedJobs } from "./completed-jobs";

// CompletedJobs is an async Server Component: each test calls it and renders
// what it returns, with next-intl's own translator over the real messages
// standing in for getTranslations.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "MyReviews" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.MyReviews;

function job(changes: Partial<CompletedJobRow> = {}): CompletedJobRow {
  return {
    bookingId: "11111111-2222-4333-8444-555555555555",
    code: "K7Q4MX",
    kind: "car",
    makeName: { en: "Honda" },
    modelName: { en: "City" },
    fuel: "petrol",
    // 19 Nov 2026 in India (19:30 UTC the day before).
    completedAt: new Date("2026-11-18T19:30:00Z"),
    reviewRating: null,
    ...changes,
  };
}

describe("CompletedJobs", () => {
  test("a job not reviewed: which visit it was, and a grey Write a review button to its review page", async () => {
    renderWithIntl(await CompletedJobs({ jobs: [job()], locale: "en" }));
    expect(screen.getByRole("heading", { level: 2, name: t.heading })).toBeTruthy();
    const item = screen.getByRole("listitem");
    expect(item.querySelector("h3")?.textContent).toBe("Honda City");
    expect(item.textContent).toContain("Completed on 19 Nov 2026");
    expect(item.textContent).toContain("Booking K7Q-4MX");
    const link = within(item).getByRole("link", { name: t.write });
    expect(link.getAttribute("href")).toBe("/account/reviews/11111111-2222-4333-8444-555555555555");
    expect(link.getAttribute("data-variant")).toBe("secondary");
  });

  test("a reviewed job: its stars, no button", async () => {
    renderWithIntl(await CompletedJobs({ jobs: [job({ reviewRating: 4 })], locale: "en" }));
    const item = screen.getByRole("listitem");
    expect(within(item).queryByRole("link")).toBeNull();
    expect(item.textContent).toContain("Rated 4 out of 5");
  });
});
