import { describe, expect, test, vi } from "vitest";

import allMessages from "../../../messages/en.json";

import { loginCodeText } from "./login-code-text";

// getTranslations from next-intl/server only works inside a Next.js request:
// here it reads messages/en.json directly.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Sms" | "Brand" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

describe("loginCodeText (the SMS with the code)", () => {
  test("holds the code, the garage's name and how long it works, with nothing left to fill in", async () => {
    const text = await loginCodeText("en", "482913");
    expect(text).toContain("482913");
    expect(text).toContain(allMessages.Brand.name);
    expect(text).toContain("5 minutes");
    expect(text).not.toMatch(/[{}]/);
  });

  test("fits in one SMS (160 characters)", async () => {
    expect((await loginCodeText("en", "482913")).length).toBeLessThanOrEqual(160);
  });
});
