import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import Home from "./page";

describe("Home page (placeholder)", () => {
  test("has exactly one level-1 heading, with the garage name", () => {
    render(<Home />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe("GoMechanic");
  });

  test("starts empty: the previous test's render was cleaned up", () => {
    // Proves vitest.setup.ts runs. Tests in a file run in order.
    expect(document.body.innerHTML).toBe("");
  });
});
