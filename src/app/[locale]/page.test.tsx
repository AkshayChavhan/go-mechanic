import { screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import Home from "./page";

describe("Home page (placeholder)", () => {
  test("has exactly one level-1 heading, with the title from messages", () => {
    renderWithIntl(<Home />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(messages.HomePage.title);
  });

  test("shows the tagline from messages", () => {
    renderWithIntl(<Home />);
    expect(screen.getByText(messages.HomePage.tagline)).toBeTruthy();
  });

  test("the page is cleaned up after each test (vitest.setup.ts runs)", () => {
    renderWithIntl(<Home />);
    // onTestFinished runs after the afterEach hooks, so by then the cleanup
    // registered in vitest.setup.ts must have emptied the page.
    onTestFinished(() => {
      expect(document.body.innerHTML).toBe("");
    });
  });
});
