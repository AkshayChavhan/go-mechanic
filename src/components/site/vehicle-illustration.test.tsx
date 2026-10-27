import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { VehicleIllustration } from "./vehicle-illustration";

describe("VehicleIllustration", () => {
  test("is a decorative inline drawing: hidden from screen readers, never focusable", () => {
    const { container } = render(<VehicleIllustration />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  test("draws in the text colour around it, so it suits every tone", () => {
    const { container } = render(<VehicleIllustration />);
    expect(container.querySelector("svg")!.getAttribute("stroke")).toBe("currentColor");
  });

  test("needs no network request (no image or external reference inside)", () => {
    const { container } = render(<VehicleIllustration />);
    expect(container.querySelector("image, use, img")).toBeNull();
  });
});
