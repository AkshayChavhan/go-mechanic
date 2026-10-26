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
