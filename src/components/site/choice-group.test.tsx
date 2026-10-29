import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ChoiceGroup } from "./choice-group";

// The words here are made up: ChoiceGroup takes its legend and labels as
// props, and the vehicle picker passes them from messages/en.json.

const fuels = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
] as const;

describe("ChoiceGroup", () => {
  test("is a group named by its legend, with one native radio per option, named by its label", () => {
    render(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} />);
    const group = screen.getByRole("group", { name: "Fuel" });
    expect(group.tagName).toBe("FIELDSET");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label") ?? radio.closest("label")?.textContent)).toEqual([
      "Petrol",
      "Diesel",
    ]);
    // Native radios sharing one name: the browser moves between them with
    // the arrow keys, and the form posts the checked one.
    for (const radio of radios) {
      expect(radio.tagName).toBe("INPUT");
      expect(radio.getAttribute("name")).toBe("fuel");
    }
  });

  test("pressing a pill's text checks its radio and reports the value", () => {
    const onChange = vi.fn();
    render(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} onChange={onChange} />);
    fireEvent.click(screen.getByText("Diesel"));
    expect((screen.getByRole("radio", { name: "Diesel" }) as HTMLInputElement).checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith("diesel");
  });

  test("every pill is a touch target at least 44px tall", () => {
    render(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} />);
    for (const radio of screen.getAllByRole("radio")) {
      // min-h-11 is 44px (jsdom has no layout; e2e/dev/design-preview.spec.ts
      // measures the real pill in a browser).
      expect(radio.closest("label")?.className).toContain("min-h-11");
    }
  });

  test("with a default, that radio starts checked and is what the form posts", () => {
    render(
      <form aria-label="Vehicle">
        <ChoiceGroup legend="Fuel" name="fuel" options={fuels} defaultValue="diesel" />
      </form>,
    );
    expect((screen.getByRole("radio", { name: "Diesel" }) as HTMLInputElement).checked).toBe(true);
    const form = screen.getByRole("form", { name: "Vehicle" }) as HTMLFormElement;
    expect(new FormData(form).get("fuel")).toBe("diesel");
  });

  test("with a value, the parent decides what's checked, including nothing yet", () => {
    const { rerender } = render(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} value={null} onChange={vi.fn()} />);
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    rerender(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} value="petrol" onChange={vi.fn()} />);
    expect((screen.getByRole("radio", { name: "Petrol" }) as HTMLInputElement).checked).toBe(true);
  });

  test("a disabled group can't be chosen", () => {
    render(<ChoiceGroup legend="Fuel" name="fuel" options={fuels} disabled />);
    // The fieldset disables them: each radio's own disabled stays false, but
    // the browser treats it as :disabled and won't check it.
    for (const radio of screen.getAllByRole("radio")) expect(radio.matches(":disabled")).toBe(true);
  });
});
