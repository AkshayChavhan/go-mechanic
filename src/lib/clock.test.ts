import { describe, expect, test } from "vitest";

import { fixedClock, systemClock } from "./clock";

// 27 Oct 2026, 10:00 in India (04:30 UTC). A new Date on every call: a Date
// can be changed in place, so sharing one between tests would let a broken
// clock in one test change what another test expects.
const tenAmIndia = () => new Date("2026-10-27T04:30:00Z");

describe("fixedClock (the clock tests use)", () => {
  test("always says it's the instant it was given", () => {
    const clock = fixedClock(tenAmIndia());
    expect(clock.now()).toEqual(tenAmIndia());
    expect(clock.now()).toEqual(tenAmIndia());
  });

  test("returns a new Date each time, so changing one result doesn't move the clock", () => {
    const clock = fixedClock(tenAmIndia());
    const first = clock.now();
    first.setUTCFullYear(2000);

    expect(clock.now()).toEqual(tenAmIndia());
    expect(clock.now()).not.toBe(clock.now());
  });

  test("keeps its own copy: changing the Date passed in doesn't move the clock", () => {
    const start = tenAmIndia();
    const clock = fixedClock(start);
    start.setUTCFullYear(2000);

    expect(clock.now()).toEqual(tenAmIndia());
  });
});

describe("systemClock (the real clock)", () => {
  test("is within a second of the computer's time", () => {
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
