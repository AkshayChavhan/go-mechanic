import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Review } from "@/content/home";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { ReviewCard } from "./review-card";

const sample: Review = {
  id: "r1",
  kind: "two-wheeler",
  rating: 4,
  comment: "Quick periodic service for my scooter.",
  credit: null,
  reply: null,
};

const real: Review = {
  id: "r2",
  kind: "car",
  rating: 5,
  comment: "Pads changed\nand the price was as quoted. <b>Great</b>",
  credit: { name: "Asha", makeName: { en: "Honda" } },
  reply: "Thank you, Asha!",
};

describe("ReviewCard", () => {
  test("the comment as a quotation, as plain text with its line breaks", () => {
    const { container } = renderWithIntl(<ReviewCard review={real} />);
    const quote = container.querySelector("blockquote")!;
    expect(quote.textContent).toBe("Pads changed\nand the price was as quoted. <b>Great</b>");
    expect(quote.className).toContain("whitespace-pre-line");
    expect(container.querySelector("b")).toBeNull();
  });

  test("screen readers hear the rating in words; the five stars are hidden from them", () => {
    const { container } = renderWithIntl(<ReviewCard review={sample} />);
    expect(screen.getByText("Rated 4 out of 5")).toBeTruthy();
    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(5);
    for (const star of stars) expect(star.getAttribute("aria-hidden")).toBe("true");
  });

  test("a sample: the Sample badge, data-sample, and credited to no real-looking person", () => {
    const { container } = renderWithIntl(<ReviewCard review={sample} sample />);
    expect(container.querySelector("[data-sample]")).not.toBeNull();
    expect(screen.getByText(messages.HomePage.sample)).toBeTruthy();
    expect(screen.getByText("Sample customer, two-wheeler")).toBeTruthy();
  });

  test("a real review: credited to the first name and the vehicle's brand and type, no badge", () => {
    const { container } = renderWithIntl(<ReviewCard review={real} />);
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(screen.getByText("Asha, Honda car")).toBeTruthy();
  });

  test("preview clamps the comment and leaves the reply out; full shows the reply", () => {
    const { container, unmount } = renderWithIntl(<ReviewCard review={real} />);
    expect(container.querySelector("blockquote")!.className).toContain("line-clamp-4");
    expect(screen.queryByText(messages.Reviews.reply)).toBeNull();
    unmount();
    const full = renderWithIntl(<ReviewCard review={real} variant="full" />);
    expect(full.container.querySelector("blockquote")!.className).not.toContain("line-clamp");
    expect(screen.getByText(messages.Reviews.reply)).toBeTruthy();
    expect(screen.getByText("Thank you, Asha!")).toBeTruthy();
  });

  test("stars only: no quotation, just the stars and the credit", () => {
    const { container } = renderWithIntl(<ReviewCard review={{ ...real, comment: null }} />);
    expect(container.querySelector("blockquote")).toBeNull();
    expect(screen.getByText("Asha, Honda car")).toBeTruthy();
  });
});
