// Where code that needs "now" gets it from (an updated_at time, a booking, a slot).
//
// Code takes a Clock as a parameter, usually with systemClock as the default,
// instead of calling `new Date()` itself. Tests then pass fixedClock(...) and
// always get the same answer, whatever the day or time they run.
//
// Never call now() while a prerendered page renders: Cache Components rejects
// reading the time there, because the answer would be frozen into the page.
// That's why the site shell works out "open now" in the browser instead.

export type Clock = {
  /** The current moment. A new Date each call, so changing it is safe. */
  now(): Date;
};

/** The real clock. */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock stopped at `instant`, for tests. */
export function fixedClock(instant: Date): Clock {
  // Keep the number, not the Date: a caller who changes their Date later
  // doesn't move this clock.
  const time = instant.getTime();
  return { now: () => new Date(time) };
}
