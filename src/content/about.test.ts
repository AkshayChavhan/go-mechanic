import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import messages from "../../messages/en.json";

import { type AboutTopic, aboutSampleCanary, aboutTopics, sampleAboutTopics, selectAboutTopics } from "./about";

// The about page's unknown facts are real, or samples, or nothing (task 19's
// plan, owner's decision of 2026-10-29): samples under `npm run dev` only.

const realTopics: AboutTopic[] = [{ id: "story", title: { en: "Our story" }, body: { en: "Real words." } }];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selectAboutTopics", () => {
  test("without real topics: the samples, marked as samples, under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(selectAboutTopics(null)).toEqual({ items: sampleAboutTopics, sample: true });
  });

  test.each(["production", "test"])("without real topics: nothing in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectAboutTopics(null)).toBeNull();
  });

  test("an empty list counts as no real topics", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectAboutTopics([])).toBeNull();
  });

  test.each(["production", "development", "test"])("with real topics: the real ones, not marked, in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectAboutTopics(realTopics)).toEqual({ items: realTopics, sample: false });
  });

  test("today a production build shows no topics (none are real yet)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectAboutTopics()).toBeNull();
    if (aboutTopics !== null) expect(aboutTopics).not.toEqual(sampleAboutTopics);
  });
});

describe("the sample topics", () => {
  test("each has an English title and body, and the ids are unique", () => {
    for (const topic of sampleAboutTopics) {
      expect(topic.title.en.trim()).not.toBe("");
      expect(topic.body.en.trim()).not.toBe("");
    }
    expect(new Set(sampleAboutTopics.map(({ id }) => id)).size).toBe(sampleAboutTopics.length);
  });

  test("say they are samples in their own words", () => {
    for (const topic of sampleAboutTopics) expect(topic.body.en).toMatch(/^A sample|^Sample/);
  });

  test("the canary is in exactly one sample, and not in the messages every build ships", () => {
    expect(aboutSampleCanary.trim().length).toBeGreaterThan(10);
    expect(sampleAboutTopics.filter(({ body }) => body.en.includes(aboutSampleCanary))).toHaveLength(1);
    expect(JSON.stringify(messages)).not.toContain(aboutSampleCanary);
  });
});

describe("the samples are reached only through the selector", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));

  test("no file under src/ but about.ts names sampleAboutTopics (tests aside)", () => {
    const files = readdirSync(src, { recursive: true, encoding: "utf8" })
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== "content/about.ts");
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter((file) => /\bsampleAboutTopics\b/.test(readFileSync(path.join(src, file), "utf8")));
    expect(users, "read samples through selectAboutTopics()").toEqual([]);
  });
});
