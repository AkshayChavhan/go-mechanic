import { describe, expect, test } from "vitest";

import { localize } from "./localized-text";

describe("localize (text stored in several languages)", () => {
  test("English text in English", () => {
    expect(localize({ en: "Oil change" }, "en")).toBe("Oil change");
  });

  test("Hindi text when it exists", () => {
    expect(localize({ en: "Oil change", hi: "ऑयल चेंज" }, "hi")).toBe("ऑयल चेंज");
  });

  test("falls back to English when the translation is missing", () => {
    expect(localize({ en: "Oil change" }, "hi")).toBe("Oil change");
  });

  test("falls back to English when the translation is blank", () => {
    expect(localize({ en: "Oil change", hi: "  " }, "hi")).toBe("Oil change");
  });

  test("falls back to English for a language we don't support", () => {
    expect(localize({ en: "Oil change" }, "mr")).toBe("Oil change");
  });

  test("falls back to English for names every object has, like constructor", () => {
    expect(localize({ en: "Oil change" }, "constructor")).toBe("Oil change");
    expect(localize({ en: "Oil change" }, "toString")).toBe("Oil change");
  });
});
