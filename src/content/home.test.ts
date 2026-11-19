import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import messages from "../../messages/en.json";

import {
  HOME_REVIEW_CARDS,
  type PublishedReviewsInput,
  sampleCanary,
  sampleReviews,
  sampleReviewsSummary,
  sampleTrustStats,
  selectHomeReviews,
  selectTrustStats,
  trustStats,
  type Shown,
  type TrustStat,
} from "./home";
import { VEHICLE_KINDS } from "@/domain/vehicles";

// The home page's trust stats and reviews are real, or samples, or nothing
// (plan KTD7, owner's decision of 2026-10-27):
// - real data shows in every build, without a "Sample" mark;
// - until there is real data, samples show under `npm run dev` only;
// - a production build without real data shows neither section.

// Made-up "real" data, to check what happens once the owner gives numbers
// (stats) and task 37 ships reviews.
const realStats: TrustStat[] = [{ id: "years", value: 12, decimals: 0, counts: true }];

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The same rules for both selectors. */
function describeSelector<T>(
  name: string,
  select: (real?: readonly T[] | null) => Shown<T> | null,
  samples: readonly T[],
  real: readonly T[],
) {
  describe(name, () => {
    test("without real data: the samples, marked as samples, under npm run dev", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(select(null)).toEqual({ items: samples, sample: true });
    });

    test("without real data: nothing in a production build", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(select(null)).toBeNull();
    });

    test("without real data: nothing in tests either", () => {
      expect(select(null)).toBeNull();
    });

    test("an empty list counts as no real data", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(select([])).toBeNull();
      vi.stubEnv("NODE_ENV", "development");
      expect(select([])).toEqual({ items: samples, sample: true });
    });

    test.each(["production", "development", "test"])("with real data: the real data, not marked, in %s", (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(select(real)).toEqual({ items: real, sample: false });
    });
  });
}

describeSelector("selectTrustStats", selectTrustStats, sampleTrustStats, realStats);

/** Published reviews as the cached read returns them: `n` reviews, newest first. */
function published(comments: (string | null)[]): PublishedReviewsInput {
  return {
    reviews: comments.map((comment, index) => ({
      id: `r${index}`,
      rating: 5,
      comment,
      kind: "car",
      shownName: "Asha",
      makeName: { en: "Honda" },
      reply: null,
    })),
    count: comments.length,
    average: comments.length === 0 ? null : 4.6,
  };
}

describe("selectHomeReviews", () => {
  test("fewer than 3 published: nothing in a production build, the samples under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectHomeReviews(published(["Good", "Fine"]), 3)).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(selectHomeReviews(published(["Good", "Fine"]), 3)).toEqual({
      items: sampleReviews,
      sample: true,
      summary: sampleReviewsSummary,
    });
  });

  test("3 published: real reviews in every build, credited, with the summary, not marked as samples", () => {
    for (const nodeEnv of ["production", "development"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      const shown = selectHomeReviews(published(["One", "Two", "Three", "Four"]), 3);
      expect(shown?.sample).toBe(false);
      expect(shown?.summary).toEqual({ average: 4.6, count: 4 });
      expect(shown?.items.map((review) => review.id)).toEqual(["r0", "r1", "r2"]);
      expect(shown?.items[0]).toMatchObject({ credit: { name: "Asha", makeName: { en: "Honda" } }, kind: "car" });
    }
  });

  test("always 3 cards: the newest with a comment first, topped up with stars-only ones", () => {
    vi.stubEnv("NODE_ENV", "production");
    const shown = selectHomeReviews(published([null, "Only comment", null, null]), 3);
    expect(shown?.items.map((review) => [review.id, review.comment])).toEqual([
      ["r1", "Only comment"],
      ["r0", null],
      ["r2", null],
    ]);
    expect(shown?.items).toHaveLength(HOME_REVIEW_CARDS);
  });
});

describe("today's data", () => {
  test("a production build shows no stats and no reviews (none are real yet)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(selectTrustStats()).toBeNull();
    expect(selectHomeReviews(published([]), 3)).toBeNull();
  });

  test("real stats, once the owner sets them, aren't the sample values copied over", () => {
    // trustStats is null until the owner gives real numbers (then the
    // samples stop showing anywhere). Copying the samples in would publish
    // made-up numbers.
    if (trustStats !== null) expect(trustStats).not.toEqual(sampleTrustStats);
  });
});

/** Every list a build might show: the samples, and the real data once it exists. */
const statLists = [sampleTrustStats, ...(trustStats ? [trustStats] : [])];
const reviewLists = [sampleReviews];

describe("trust stats the page can show", () => {
  test.each(statLists.map((list, index) => [index === 0 ? "samples" : "real", list] as const))(
    "%s: the three stats, once each, in the brief's order",
    (_name, list) => {
      // features.md, Home: years, vehicles serviced, warranty. The rating is
      // the reviews' own average since task 37 (owner, 2026-11-19).
      expect(list.map(({ id }) => id)).toEqual(["years", "vehicles", "warranty"]);
    },
  );

  test.each(statLists.flat())("$id: a finite, positive value with whole decimals", ({ value, decimals }) => {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
    expect(Number.isInteger(decimals)).toBe(true);
    expect(decimals).toBeGreaterThanOrEqual(0);
  });

  test.each(statLists.flat().filter(({ id }) => id === "warranty"))("the warranty is shown, not counted", ({ counts }) => {
    expect(counts).toBe(false);
  });
});

describe("reviews the page can show", () => {
  test.each(reviewLists.flat())("$id: a whole rating from 1 to 5, a vehicle kind, a comment and no credit", (review) => {
    expect(Number.isInteger(review.rating)).toBe(true);
    expect(review.rating).toBeGreaterThanOrEqual(1);
    expect(review.rating).toBeLessThanOrEqual(5);
    expect(VEHICLE_KINDS).toContain(review.kind);
    expect(review.comment?.trim()).toBeTruthy();
    // A sample is never credited to a real-looking person.
    expect(review.credit).toBeNull();
  });

  test("the samples' summary is made up and says so through the sample mark", () => {
    expect(sampleReviewsSummary.count).toBe(sampleReviews.length);
  });

  test("ids are unique", () => {
    for (const list of reviewLists) {
      const ids = list.map(({ id }) => id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("the sample canary", () => {
  // U6 searches a production build's HTML, page data and JavaScript for this
  // phrase. It must be in a sample review, and nowhere else a build could
  // pick it up, or that search would prove nothing.
  test("is in exactly one sample review", () => {
    expect(sampleCanary.trim().length).toBeGreaterThan(10);
    expect(sampleReviews.filter(({ comment }) => comment?.includes(sampleCanary))).toHaveLength(1);
  });

  test("isn't in the messages, which every build ships", () => {
    expect(JSON.stringify(messages)).not.toContain(sampleCanary);
  });
});

describe("the samples are reached only through the selectors", () => {
  // showSamples() is the one switch for samples (CLAUDE.md, src/lib/samples.ts).
  // Code that used sampleTrustStats or sampleReviews directly would skip it:
  // a dev page behind devOnly() would show them on a staging server that
  // shows dev pages. So outside this file, only the selectors may be used.
  const src = fileURLToPath(new URL("..", import.meta.url));

  test("no file under src/ but home.ts uses sampleTrustStats or sampleReviews (tests aside)", () => {
    const files = readdirSync(src, { recursive: true, encoding: "utf8" })
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== "content/home.ts");
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter((file) => /\bsample(?:TrustStats|Reviews)\b/.test(readFileSync(path.join(src, file), "utf8")));
    expect(users, "read samples through selectTrustStats() and selectHomeReviews()").toEqual([]);
  });
});
