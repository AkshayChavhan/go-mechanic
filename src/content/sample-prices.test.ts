import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import messages from "../../messages/en.json";

import { checkServices, type ServicePrice } from "@/domain/services";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";

import { samplePrices, selectPrices } from "./sample-prices";

// Prices are real, or samples, or nothing (the owner's decision of
// 2026-10-29, task 18):
// - real prices show in every build, without a "Sample" mark;
// - until there's a real price, samples show under `npm run dev` only;
// - a production build without real prices shows no price at all.

afterEach(() => {
  vi.unstubAllEnvs();
});

const realPrice: ServicePrice = { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 140_000 };

describe("selectPrices", () => {
  test("without real prices: the samples, marked as samples, under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(selectPrices([])).toEqual({ items: samplePrices, sample: true });
  });

  test.each(["production", "test"])("without real prices: nothing in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectPrices([])).toBeNull();
  });

  test.each(["production", "development", "test"])(
    "with one real price: only the real prices, not marked, in %s",
    (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(selectPrices([realPrice])).toEqual({ items: [realPrice], sample: false });
    },
  );
});

describe("the sample prices", () => {
  test("pass every check against the draft services and price groups", () => {
    expect(checkServices(draftServices, samplePrices, draftCatalogue.categories)).toEqual([]);
  });

  test("price every list-priced service and package in every price group it covers", () => {
    for (const service of draftServices.filter((candidate) => !candidate.pricedAfterInspection)) {
      const groups = draftCatalogue.categories.filter((category) => service.vehicleKinds.includes(category.kind));
      for (const group of groups) {
        const row = samplePrices.find((price) => price.serviceId === service.id && price.categoryId === group.id);
        expect(row, `${service.id} in ${group.id}`).toBeDefined();
      }
    }
  });

  test("give no price to a service priced after an inspection", () => {
    const onInspection = new Set(draftServices.filter((service) => service.pricedAfterInspection).map(({ id }) => id));
    expect(samplePrices.filter((price) => onInspection.has(price.serviceId))).toEqual([]);
  });
});

describe("no price reaches a build by another way", () => {
  test("the messages, which every build ships, hold no rupee sign", () => {
    expect(JSON.stringify(messages)).not.toContain("₹");
  });

  // showSamples() is the one switch for samples (CLAUDE.md, src/lib/samples.ts).
  // Code that used samplePrices directly would skip it, and a client component
  // that imported this file would ship every sample price to the browser.
  const src = fileURLToPath(new URL("..", import.meta.url));
  const files = readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file));
  const read = (file: string) => readFileSync(path.join(src, file), "utf8");

  test("no file under src/ but sample-prices.ts uses samplePrices (tests aside)", () => {
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter((file) => file !== "content/sample-prices.ts" && /\bsamplePrices\b/.test(read(file)));
    expect(users, "read prices through selectPrices()").toEqual([]);
  });

  test("no client component imports the sample prices", () => {
    // Anywhere at the start of a line: a few files put a comment block first.
    const clients = files.filter((file) => /^["']use client["'];?\s*$/m.test(read(file)));
    expect(clients.length).toBeGreaterThan(0);
    const importers = clients.filter((file) => read(file).includes("@/content/sample-prices"));
    expect(importers, "pass prices to client components as props").toEqual([]);
  });
});
