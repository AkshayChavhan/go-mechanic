import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readPublishedReviews } from "@/server/dal/reviews";
import messages from "../../../../../messages/en.json";

import ReviewsPage, { ensureStatic, generateMetadata } from "./page";

vi.mock("@/server/dal/reviews", () => ({ readPublishedReviews: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: allMessages, namespace: namespace as "ReviewsPage" }),
  };
});

const t = messages.ReviewsPage;

function review(id: string, changes: Record<string, unknown> = {}) {
  return {
    id,
    rating: 5 as const,
    comment: `Comment ${id}`,
    shownName: "Asha",
    kind: "car" as const,
    makeName: { en: "Honda" },
    modelName: { en: "City" },
    reply: null,
    createdAt: new Date("2026-11-19T10:00:00Z"),
    ...changes,
  };
}

beforeEach(() => {
  vi.mocked(readPublishedReviews).mockResolvedValue({ reviews: [], count: 0, average: null });
});

describe("/reviews", () => {
  test("is built ahead of time, with its own title and description", async () => {
    expect(ensureStatic).toBe("navigation");
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Customer reviews | GoMechanic");
    expect(String(metadata.description)).toContain("GoMechanic");
  });

  test("none yet: one heading, the empty state and how to leave one, no average", async () => {
    renderWithIntl(await ReviewsPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.empty)).toBeTruthy();
    expect(screen.getByText(t.howTo)).toBeTruthy();
    expect(screen.queryByText(/out of 5 ·/)).toBeNull();
  });

  test("the published reviews in the order read (newest first), with the summary, credits and replies, no model", async () => {
    vi.mocked(readPublishedReviews).mockResolvedValue({
      reviews: [review("b", { reply: "Thank you!" }), review("a", { comment: null, rating: 3 })],
      count: 2,
      average: 4,
    });
    const { container } = renderWithIntl(await ReviewsPage());
    expect(screen.getByText("4.0 out of 5 · 2 reviews")).toBeTruthy();
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Comment b");
    expect(items[0]!.textContent).toContain(messages.Reviews.reply);
    expect(items[1]!.querySelector("blockquote")).toBeNull();
    expect(container.textContent).toContain("Asha, Honda car");
    expect(container.textContent).not.toContain("City");
    expect(container.querySelector("[data-sample]")).toBeNull();
  });
});
