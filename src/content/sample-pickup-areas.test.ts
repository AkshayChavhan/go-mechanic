import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import { isIndianPinCode } from "@/domain/garage";
import type { PickupArea } from "@/domain/pickup";

import { samplePickupAreas, selectPickupAreas } from "./sample-pickup-areas";

// Pickup areas are real, or samples, or nothing (task 24): the same rule as
// the sample prices (sample-prices.test.ts).

afterEach(() => {
  vi.unstubAllEnvs();
});

const realArea: PickupArea = { postalCode: "412101", feePaise: 15_000 };

describe("selectPickupAreas", () => {
  test("without real areas: the samples, marked as samples, under npm run dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(selectPickupAreas([])).toEqual({ items: samplePickupAreas, sample: true });
  });

  test.each(["production", "test"])("without real areas: nothing in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectPickupAreas([])).toBeNull();
  });

  test.each(["production", "development", "test"])("with one real area: only the real ones, not marked, in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(selectPickupAreas([realArea])).toEqual({ items: [realArea], sample: false });
  });
});

describe("the sample areas", () => {
  test("are real-looking PIN codes in order, each once, with whole-rupee fees and one free", () => {
    const codes = samplePickupAreas.map((area) => area.postalCode);
    expect(codes.every(isIndianPinCode)).toBe(true);
    expect(codes).toEqual([...new Set(codes)].sort());
    expect(samplePickupAreas.every((area) => area.feePaise >= 0 && area.feePaise % 100 === 0)).toBe(true);
    expect(samplePickupAreas.some((area) => area.feePaise === 0)).toBe(true);
  });
});

describe("no sample area reaches a build or a booking by another way", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));
  const files = readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file));
  const read = (file: string) => readFileSync(path.join(src, file), "utf8");

  test("no file under src/ but sample-pickup-areas.ts uses samplePickupAreas (tests aside)", () => {
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter(
      (file) => file !== "content/sample-pickup-areas.ts" && /\bsamplePickupAreas\b/.test(read(file)),
    );
    expect(users, "read areas through selectPickupAreas()").toEqual([]);
  });

  test("no client component and no data-access code imports the samples", () => {
    const clients = files.filter((file) => /^["']use client["'];?\s*$/m.test(read(file)));
    expect(clients.length).toBeGreaterThan(0);
    const importers = [...clients, ...files.filter((file) => file.startsWith("server/"))].filter((file) =>
      read(file).includes("@/content/sample-pickup-areas"),
    );
    expect(importers, "pass areas to client components as props; bookings use real areas only").toEqual([]);
  });
});
