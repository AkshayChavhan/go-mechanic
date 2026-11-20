import { describe, expect, test, vi } from "vitest";

import messages from "../../../../../../../messages/en.json";

import ReviewJobPage, { generateMetadata } from "./page";
import { ReviewGate } from "./review-gate";

// The gate is a stand-in: it records the labels the page builds ahead of time.
vi.mock("./review-gate", () => ({ ReviewGate: vi.fn(() => null) }));
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
    expect(metadata.title).toBe(messages.ReviewPage.metaTitle.replace("{brand}", messages.Brand.name));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test("hands the form the counter's raw template, which the form fills on every keystroke", async () => {
    const page = await ReviewJobPage({ params: Promise.resolve({ locale: "en", bookingId: "b1" }) } as never);
    // The gate sits inside the page's Suspense, as a child of params.then(...).
    const suspense = (page.props.children as { props: { children: unknown[] } }).props.children[1] as {
      props: { children: Promise<{ props: Parameters<typeof ReviewGate>[0] }> };
    };
    const gate = await suspense.props.children;
    expect(gate.props.labels.commentCount).toBe(messages.ReviewPage.commentCount);
    expect(gate.props.labels.starLabels[3]).toBe("3 out of 5 stars");
    expect(gate.props.bookingId).toBe("b1");
  });
});
