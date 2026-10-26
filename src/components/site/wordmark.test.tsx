import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Wordmark } from "@/components/site/wordmark";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

describe("Wordmark", () => {
  test("shows the brand name from messages, never machine-translated", () => {
    renderWithIntl(<Wordmark />);
    const wordmark = screen.getByText(messages.Brand.name);
    // Chrome offers Indian visitors automatic translation into Hindi.
    expect(wordmark.getAttribute("translate")).toBe("no");
  });

  test("is set in the brand font, and takes its size from className", () => {
    renderWithIntl(<Wordmark className="type-title" />);
    const classes = [...screen.getByText(messages.Brand.name).classList];
    expect(classes).toEqual(expect.arrayContaining(["font-brand", "type-title"]));
  });

  test("is not a heading (pages choose their own h1)", () => {
    renderWithIntl(<Wordmark />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
