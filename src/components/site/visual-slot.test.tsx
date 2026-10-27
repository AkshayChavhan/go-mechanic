import { render, screen } from "@testing-library/react";
import type { StaticImageData } from "next/image";
import { describe, expect, test } from "vitest";

import { VisualSlot } from "./visual-slot";

// What a static import (import photo from "@/assets/workshop.jpg") gives.
const photo: StaticImageData = { src: "/_next/static/media/workshop.jpg", width: 1600, height: 1000 };

describe("VisualSlot", () => {
  test("without a photo: the line illustration, hidden from screen readers, and no image", () => {
    const { container } = render(<VisualSlot photo={null} sizes="100vw" />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("with a photo: an image with the alt text passed in, filling the slot", () => {
    render(<VisualSlot photo={photo} alt="A mechanic checking a car's brakes" sizes="50vw" />);
    const image = screen.getByRole("img", { name: "A mechanic checking a car's brakes" });
    expect(image.getAttribute("sizes")).toBe("50vw");
    // fill: the image is absolutely positioned inside the slot's box.
    expect((image as HTMLImageElement).style.position).toBe("absolute");
  });

  test("a photo loads lazily by default", () => {
    render(<VisualSlot photo={photo} alt="Workshop" sizes="100vw" />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("lazy");
  });

  test("the hero's photo loads eagerly, with high priority (never the deprecated priority prop)", () => {
    render(<VisualSlot photo={photo} alt="Workshop" sizes="100vw" eager />);
    const image = screen.getByRole("img");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("fetchpriority")).toBe("high");
  });

  test("keeps a fixed shape, so the page doesn't move when a photo arrives", () => {
    const { container } = render(<VisualSlot photo={null} sizes="100vw" />);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/\baspect-/);
  });
});
