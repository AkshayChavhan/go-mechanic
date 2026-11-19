import { describe, expect, test, vi } from "vitest";

import { generateMetadata } from "./page";

vi.mock("./review-gate", () => ({ ReviewGate: () => null }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: allMessages, namespace: namespace as "ReviewPage" }),
  };
});

describe("/account/reviews/[bookingId]", () => {
  test("its title, and noindex: a personal page", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Review your job | GoMechanic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
