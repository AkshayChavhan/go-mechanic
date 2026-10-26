import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Section } from "@/components/site/section";

/** The rendered <section> and the content box inside it. */
function renderSection(ui: React.ReactElement) {
  const { container } = render(ui);
  const section = container.querySelector("section");
  if (!section) throw new Error("no <section> rendered");
  return { section, content: section.firstElementChild as HTMLElement };
}

describe("Section", () => {
  test("is a white page section by default, with the content width", () => {
    const { section, content } = renderSection(<Section>Brakes</Section>);
    expect(section.classList).not.toContain("surface-grey");
    expect(section.classList).not.toContain("dark");
    expect(content.classList).toContain("max-w-content");
  });

  test.each([
    ["grey", "surface-grey"],
    ["dark", "dark"],
  ] as const)('tone="%s" adds the %s surface class', (tone, className) => {
    const { section } = renderSection(<Section tone={tone}>Brakes</Section>);
    expect(section.classList).toContain(className);
  });

  test("paints its tone and spaces itself from the tokens", () => {
    const { section, content } = renderSection(<Section>Brakes</Section>);
    expect([...section.classList]).toEqual(
      expect.arrayContaining(["bg-background", "text-foreground", "py-(--section-space)"]),
    );
    expect(content.classList).toContain("px-(--gutter)");
  });

  test("a className passed in wins over its own spacing", () => {
    // /dev/design frames small samples with className="py-6".
    const { section } = renderSection(<Section className="py-6">Brakes</Section>);
    expect(section.classList).toContain("py-6");
    expect(section.classList).not.toContain("py-(--section-space)");
  });

  test('width="wide" uses the wide content width', () => {
    const { content } = renderSection(<Section width="wide">Brakes</Section>);
    expect(content.classList).toContain("max-w-wide");
    expect(content.classList).not.toContain("max-w-content");
  });

  test("passes id and aria-labelledby to the <section>, and puts children in the content box", () => {
    const { section, content } = renderSection(
      <Section id="services" aria-labelledby="services-title">
        <h2 id="services-title">Services</h2>
      </Section>,
    );
    expect(section.id).toBe("services");
    expect(section.getAttribute("aria-labelledby")).toBe("services-title");
    expect(within(content).getByRole("heading", { name: "Services" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Services" })).toBe(section);
  });
});
