import { describe, expect, test } from "vitest";

import { checkedLocale, formText } from "./form-input";

describe("checkedLocale", () => {
  test("passes a known locale through, and throws for anything else", () => {
    expect(checkedLocale("en")).toBe("en");
    expect(() => checkedLocale("xx")).toThrow("Unknown locale");
  });
});

describe("formText", () => {
  test("a field's text, or an empty string when it's missing or a file", () => {
    const data = new FormData();
    data.set("name", " Asha ");
    data.set("photo", new File(["x"], "photo.jpg"));
    expect(formText(data, "name")).toBe(" Asha ");
    expect(formText(data, "missing")).toBe("");
    expect(formText(data, "photo")).toBe("");
  });
});
