import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { CheckboxField } from "./checkbox-field";

// The sentences here are made up: CheckboxField takes its label as a prop,
// and the login page passes it from messages/en.json.

describe("CheckboxField", () => {
  test("is a real checkbox, ticked by pressing anywhere on its label", () => {
    render(<CheckboxField name="age" label="I am 18 or older." />);
    const box = screen.getByRole("checkbox", { name: "I am 18 or older." });
    // A native <input type="checkbox">: it works before JavaScript loads and
    // is sent with the form as age=on.
    expect(box.tagName).toBe("INPUT");
    expect(box.getAttribute("type")).toBe("checkbox");
    expect(box.getAttribute("name")).toBe("age");

    fireEvent.click(screen.getByText("I am 18 or older."));
    expect((box as HTMLInputElement).checked).toBe(true);
  });

  test("the whole row is the touch target: a label at least 44px tall around the box", () => {
    render(<CheckboxField name="age" label="I am 18 or older." />);
    const row = screen.getByRole("checkbox").closest("label");
    expect(row).not.toBeNull();
    // min-h-11 is 44px (jsdom has no layout, so the class is what we can check;
    // e2e/dev/design-preview.spec.ts measures the real row in a browser).
    expect(row!.className).toContain("min-h-11");
  });

  test("passes form props through: required, ticked by default", () => {
    render(<CheckboxField name="consent" label="I agree." required defaultChecked />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.required).toBe(true);
    expect(box.checked).toBe(true);
  });

  test("an error shows under the row, marks the box invalid and describes it", () => {
    render(<CheckboxField name="age" label="I am 18 or older." error="Tick this box to continue." />);
    const box = screen.getByRole("checkbox");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByText("Tick this box to continue.");
    expect(box.getAttribute("aria-describedby")).toBe(error.id);
    // FieldError is an alert: screen readers say it as soon as it appears.
    expect(error.getAttribute("role")).toBe("alert");
  });

  test("keeps a description the caller points to, next to its own error", () => {
    render(
      <>
        <p id="notice">We keep your number.</p>
        <CheckboxField name="consent" label="I agree." aria-describedby="notice" error="Tick this box." />
      </>,
    );
    const box = screen.getByRole("checkbox");
    const errorId = screen.getByText("Tick this box.").id;
    expect(box.getAttribute("aria-describedby")).toBe(`notice ${errorId}`);
  });

  test("without an error: not invalid, and nothing extra under the row", () => {
    const { container } = render(<CheckboxField name="age" label="I am 18 or older." />);
    const box = screen.getByRole("checkbox");
    expect(box.hasAttribute("aria-invalid")).toBe(false);
    expect(box.hasAttribute("aria-describedby")).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("a caller can mark it invalid for a shared error under a group of boxes", () => {
    render(<CheckboxField name="age" label="I am 18 or older." aria-invalid aria-describedby="group-error" />);
    const box = screen.getByRole("checkbox");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe("group-error");
  });
});
