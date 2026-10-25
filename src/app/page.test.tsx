import { render, screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vitest";

import Home from "./page";

describe("Home page (placeholder)", () => {
  test("has exactly one level-1 heading, with the garage name", () => {
    render(<Home />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe("GoMechanic");
  });

  test("the page is cleaned up after each test (vitest.setup.ts runs)", () => {
    render(<Home />);
    // onTestFinished runs after the afterEach hooks, so by then the cleanup
    // registered in vitest.setup.ts must have emptied the page.
    onTestFinished(() => {
      expect(document.body.innerHTML).toBe("");
    });
  });
});
