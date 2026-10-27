import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Review } from "@/content/home";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { ReviewCard } from "./review-card";

const review: Review = {
  id: "r1",
  vehicle: "two-wheeler",
  rating: 4,
  text: { en: "Quick periodic service for my scooter." },
};

describe("ReviewCard", () => {
  test("the review's text as a quotation", () => {
    const { container } = renderWithIntl(<ReviewCard review={review} />);
    expect(container.querySelector("blockquote")!.textContent).toBe("Quick periodic service for my scooter.");
  });

  test("screen readers hear the rating in words; the five stars are hidden from them", () => {
    const { container } = renderWithIntl(<ReviewCard review={review} />);
    expect(screen.getByText("Rated 4 out of 5")).toBeTruthy();
    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(5);
    for (const star of stars) expect(star.getAttribute("aria-hidden")).toBe("true");
  });

  test("a sample: the Sample badge, data-sample, and credited to no real-looking person", () => {
    const { container } = renderWithIntl(<ReviewCard review={review} sample />);
    expect(container.querySelector("[data-sample]")).not.toBeNull();
    expect(screen.getByText(messages.HomePage.sample)).toBeTruthy();
    expect(screen.getByText("Sample customer with a two-wheeler")).toBeTruthy();
  });

  test("a real review: no badge, no data-sample", () => {
    const { container } = renderWithIntl(<ReviewCard review={{ ...review, vehicle: "car" }} />);
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(screen.queryByText(messages.HomePage.sample)).toBeNull();
    expect(screen.getByText("Customer with a car")).toBeTruthy();
  });
});
