import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";

import { StarRatingInput } from "./star-rating-input";

const starLabels = { 1: "1 out of 5 stars", 2: "2 out of 5 stars", 3: "3 out of 5 stars", 4: "4 out of 5 stars", 5: "5 out of 5 stars" };

describe("StarRatingInput", () => {
  test("five native radios in a fieldset with its legend, each named for screen readers", () => {
    const { container } = renderWithIntl(<StarRatingInput legend="Your rating" name="rating" starLabels={starLabels} />);
    expect(screen.getByRole("group", { name: "Your rating" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(Object.values(starLabels));
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(radios.every((radio) => (radio as HTMLInputElement).name === "rating")).toBe(true);
    // Each star is a 44px target; its icon is decorative.
    for (const label of container.querySelectorAll("label")) expect(label.className).toContain("size-11");
    for (const star of container.querySelectorAll("svg")) expect(star.getAttribute("aria-hidden")).toBe("true");
  });

  test("controlled: the chosen radio is checked, and choosing calls onChange with the number", () => {
    const onChange = vi.fn();
    renderWithIntl(<StarRatingInput legend="Your rating" name="rating" starLabels={starLabels} value={3} onChange={onChange} />);
    expect((screen.getByRole("radio", { name: "3 out of 5 stars" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "5 out of 5 stars" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  test("an error shows under the stars and marks the group invalid", () => {
    const { container } = renderWithIntl(
      <StarRatingInput legend="Your rating" name="rating" starLabels={starLabels} error="Choose a rating." errorId="e1" />,
    );
    expect(screen.getByText("Choose a rating.").id).toBe("e1");
    // Every star is described by the error, so it's heard with whichever has focus.
    for (const radio of screen.getAllByRole("radio")) expect(radio.getAttribute("aria-describedby")).toBe("e1");
    expect(container.querySelector('[data-slot="star-rating"]')!.getAttribute("data-invalid")).toBe("true");
  });
});
