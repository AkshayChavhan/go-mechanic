import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import messages from "../../messages/en.json";

import { FAQ_GROUPS, type FaqItem, faqItems, faqSampleCanary, sampleFaqItems, selectFaqItems } from "./faq";

// The FAQ's unknown answers are real, or samples, or nothing (task 19's plan,
// owner's decision of 2026-10-29): samples under `npm run dev` only.

const realItems: FaqItem[] = [{ id: "r1", group: "work", question: { en: "Warranty?" }, answer: { en: "Real words." } }];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selectFaqItems", () => {
  test("without real answers: the samples, marked as samples, under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(selectFaqItems(null)).toEqual({ items: sampleFaqItems, sample: true });
  });

  test.each(["production", "test"])("without real answers: nothing in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectFaqItems(null)).toBeNull();
  });

  test("an empty list counts as no real answers", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectFaqItems([])).toBeNull();
  });

  test.each(["production", "development", "test"])("with real answers: the real ones, not marked, in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectFaqItems(realItems)).toEqual({ items: realItems, sample: false });
  });

  test("today a production build shows no sample answers (none are real yet)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectFaqItems()).toBeNull();
    if (faqItems !== null) expect(faqItems).not.toEqual(sampleFaqItems);
  });
});

describe("the sample answers", () => {
  test("each is in a known group, with an English question and answer, and the ids are unique", () => {
    for (const item of sampleFaqItems) {
      expect(FAQ_GROUPS).toContain(item.group);
      expect(item.question.en.trim()).not.toBe("");
      expect(item.answer.en.trim()).not.toBe("");
    }
    expect(new Set(sampleFaqItems.map(({ id }) => id)).size).toBe(sampleFaqItems.length);
  });

  test("say they are samples in their own words", () => {
    for (const item of sampleFaqItems) expect(item.answer.en).toMatch(/^A sample answer/);
  });

  test("the canary is in exactly one sample, and not in the messages every build ships", () => {
    expect(faqSampleCanary.trim().length).toBeGreaterThan(10);
    expect(sampleFaqItems.filter(({ answer }) => answer.en.includes(faqSampleCanary))).toHaveLength(1);
    expect(JSON.stringify(messages)).not.toContain(faqSampleCanary);
  });
});

describe("the samples are reached only through the selector", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));

  test("no file under src/ but faq.ts names sampleFaqItems (tests aside)", () => {
    const files = readdirSync(src, { recursive: true, encoding: "utf8" })
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== "content/faq.ts");
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter((file) => /\bsampleFaqItems\b/.test(readFileSync(path.join(src, file), "utf8")));
    expect(users, "read samples through selectFaqItems()").toEqual([]);
  });
});
