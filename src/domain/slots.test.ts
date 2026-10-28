import { describe, expect, test } from "vitest";

import type { WeeklyHours } from "./opening-hours";
import { availableSlots, checkSlotRequest, checkSlotRules, type Schedule, type SlotDay, type SlotRules } from "./slots";

// Every instant below is written in UTC (the "Z" at the end), with the India
// time it stands for in a comment. India is 5 hours 30 minutes ahead of UTC.
// 28 Oct 2026 is a Wednesday; 2 Nov 2026 is a Monday (the garage's closed day).

/** The garage's real hours (src/server/db/seed-data.ts), copied so these tests stand alone. */
const garageHours: WeeklyHours = {
  monday: "closed",
  tuesday: { opens: "10:00", closes: "19:00" },
  wednesday: { opens: "10:00", closes: "19:00" },
  thursday: { opens: "10:00", closes: "19:00" },
  friday: { opens: "10:00", closes: "19:00" },
  saturday: { opens: "10:00", closes: "19:00" },
  sunday: { opens: "10:00", closes: "19:00" },
};

/** The owner's rules (2026-10-28): 1-hour slots, 2 vehicles (a placeholder), tomorrow to 7 days ahead. */
const ownerRules: SlotRules = { slotMinutes: 60, capacity: 2, minDaysAhead: 1, maxDaysAhead: 7 };

function schedule(changes: Partial<Schedule> = {}): Schedule {
  return { hours: garageHours, rules: ownerRules, closedDates: new Set(), ...changes };
}

/** Wednesday 28 Oct 2026, 17:54 in India. */
const now = new Date("2026-10-28T12:24:00Z");
const noneReserved = new Map<number, number>();
const at = (iso: string) => new Date(iso);

function openDay(day: SlotDay | undefined) {
  if (day?.status !== "open") throw new Error(`expected an open day, got ${JSON.stringify(day)}`);
  return day;
}

/** "10:00"-style India times of a day's slots. */
const startTimes = (day: SlotDay | undefined) =>
  openDay(day).slots.map((slot) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(
      slot.startsAt,
    ),
  );

describe("the test setup", () => {
  test("runs in UTC (vitest.config.mts), so a computer set to India time can't hide a bug", () => {
    expect(process.env.TZ).toBe("UTC");
  });
});

describe("availableSlots: the booking window", () => {
  test("is tomorrow to 7 days ahead: 29 Oct to 4 Nov, with Monday closed", () => {
    const days = availableSlots(schedule(), noneReserved, now);
    expect(days.map((day) => [day.date, day.weekday, day.status])).toEqual([
      ["2026-10-29", "thursday", "open"],
      ["2026-10-30", "friday", "open"],
      ["2026-10-31", "saturday", "open"],
      ["2026-11-01", "sunday", "open"],
      ["2026-11-02", "monday", "closed-weekday"],
      ["2026-11-03", "tuesday", "open"],
      ["2026-11-04", "wednesday", "open"],
    ]);
  });

  test("an open day has 9 one-hour slots, 10:00 to 18:00 starts, each with 2 places: 54 in all", () => {
    const days = availableSlots(schedule(), noneReserved, now);
    expect(startTimes(days[0])).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
    const slots = days.flatMap((day) => (day.status === "open" ? day.slots : []));
    expect(slots).toHaveLength(54);
    expect(new Set(slots.map((slot) => slot.remaining))).toEqual(new Set([2]));
  });

  test("slots start and end at the right moments", () => {
    const days = availableSlots(schedule(), noneReserved, now);
    const first = openDay(days[0]).slots[0];
    // 10:00 to 11:00 on 29 Oct in India.
    expect(first.startsAt.toISOString()).toBe("2026-10-29T04:30:00.000Z");
    expect(first.endsAt.toISOString()).toBe("2026-10-29T05:30:00.000Z");
    // 18:00 on 4 Nov in India.
    expect(openDay(days[6]).slots.at(-1)?.startsAt.toISOString()).toBe("2026-11-04T12:30:00.000Z");
  });

  test.each([
    // 23:59 on 28 Oct in India: tomorrow is still the 29th.
    ["2026-10-28T18:29:00Z", "2026-10-29", "2026-11-04"],
    // 00:01 on 29 Oct in India, while UTC still says the 28th: tomorrow is the 30th.
    ["2026-10-28T18:31:00Z", "2026-10-30", "2026-11-05"],
    // 05:29 on 29 Oct in India, UTC still the 28th.
    ["2026-10-28T23:59:00Z", "2026-10-30", "2026-11-05"],
  ])("follows India's date, not UTC's: at %s the window is %s to %s", (instant, first, last) => {
    const days = availableSlots(schedule(), noneReserved, at(instant));
    expect(days[0].date).toBe(first);
    expect(days.at(-1)?.date).toBe(last);
  });

  test("crosses a year end", () => {
    // 17:30 on Wednesday 30 Dec 2026 in India.
    const days = availableSlots(schedule(), noneReserved, at("2026-12-30T12:00:00Z"));
    expect(days.map((day) => [day.date, day.status])).toEqual([
      ["2026-12-31", "open"],
      ["2027-01-01", "open"],
      ["2027-01-02", "open"],
      ["2027-01-03", "open"],
      ["2027-01-04", "closed-weekday"],
      ["2027-01-05", "open"],
      ["2027-01-06", "open"],
    ]);
  });

  test("crosses the end of a leap-year February", () => {
    // 17:30 on Sunday 27 Feb 2028 in India.
    const days = availableSlots(schedule(), noneReserved, at("2028-02-27T12:00:00Z"));
    expect(days.map((day) => day.date)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
    expect(days[0].weekday).toBe("monday");
    expect(days[0].status).toBe("closed-weekday");
  });

  test("a closed date in the window has no slots", () => {
    const days = availableSlots(schedule({ closedDates: new Set(["2026-10-31"]) }), noneReserved, now);
    expect(days[2]).toEqual({ date: "2026-10-31", weekday: "saturday", status: "closed-date" });
    expect(days[1].status).toBe("open");
  });

  test("a closed date outside the window changes nothing", () => {
    const days = availableSlots(schedule({ closedDates: new Set(["2026-10-28", "2026-11-05"]) }), noneReserved, now);
    expect(days.filter((day) => day.status === "closed-date")).toEqual([]);
  });
});

describe("availableSlots: places left", () => {
  // 10:00 on Thursday 29 Oct in India.
  const thursday10 = at("2026-10-29T04:30:00Z").getTime();

  test.each([
    [1, 1],
    [2, 0],
    // More than capacity: the owner lowered it after bookings were made.
    [3, 0],
  ])("%i place(s) taken leaves %i, and the slot stays listed", (taken, left) => {
    const days = availableSlots(schedule(), new Map([[thursday10, taken]]), now);
    const slots = openDay(days[0]).slots;
    expect(slots[0]).toMatchObject({ startsAt: new Date(thursday10), remaining: left });
    expect(slots[1].remaining).toBe(2);
  });

  test("ignores counts for slots outside the window", () => {
    const yesterday = at("2026-10-27T04:30:00Z").getTime();
    const days = availableSlots(schedule(), new Map([[yesterday, 2]]), now);
    expect(days.flatMap((day) => (day.status === "open" ? day.slots : [])).every((s) => s.remaining === 2)).toBe(true);
  });
});

describe("availableSlots: hours that aren't whole hours", () => {
  const withThursday = (opens: string, closes: string) =>
    schedule({ hours: { ...garageHours, thursday: { opens, closes } } });

  test("closing at 18:30 drops the part-slot: the last starts at 17:00", () => {
    const days = availableSlots(withThursday("10:00", "18:30"), noneReserved, now);
    expect(startTimes(days[0]).at(-1)).toBe("17:00");
  });

  test("opening at 10:30 starts the slots at 11:00, on the hour", () => {
    const days = availableSlots(withThursday("10:30", "19:00"), noneReserved, now);
    expect(startTimes(days[0])).toEqual(["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
  });

  test("a day shorter than one slot is open but has none", () => {
    const days = availableSlots(withThursday("10:00", "10:30"), noneReserved, now);
    expect(days[0]).toMatchObject({ status: "open", slots: [] });
  });

  test("hours that fail checkDayHours count as closed", () => {
    const days = availableSlots(withThursday("19:00", "10:00"), noneReserved, now);
    expect(days[0].status).toBe("closed-weekday");
  });

  test("2-hour slots start on even hours", () => {
    const days = availableSlots(schedule({ rules: { ...ownerRules, slotMinutes: 120 } }), noneReserved, now);
    expect(startTimes(days[0])).toEqual(["10:00", "12:00", "14:00", "16:00"]);
  });
});

describe("availableSlots: same-day booking, if the owner ever allows it", () => {
  test("never lists a slot that has started", () => {
    // 12:20 on Wednesday 28 Oct in India.
    const midday = at("2026-10-28T06:50:00Z");
    const days = availableSlots(schedule({ rules: { ...ownerRules, minDaysAhead: 0 } }), noneReserved, midday);
    expect(days[0].date).toBe("2026-10-28");
    expect(startTimes(days[0])).toEqual(["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
  });
});

describe("checkSlotRules", () => {
  test("the owner's rules are fine", () => {
    expect(checkSlotRules(ownerRules)).toEqual([]);
  });

  test.each([
    [{ slotMinutes: 0 }, "slotMinutes"],
    [{ slotMinutes: 14 }, "slotMinutes"],
    [{ slotMinutes: 481 }, "slotMinutes"],
    [{ slotMinutes: 60.5 }, "slotMinutes"],
    [{ capacity: 0 }, "capacity"],
    [{ capacity: -1 }, "capacity"],
    [{ capacity: 51 }, "capacity"],
    [{ minDaysAhead: -1 }, "minDaysAhead"],
    [{ maxDaysAhead: 61 }, "maxDaysAhead"],
    [{ minDaysAhead: 3, maxDaysAhead: 2 }, "maxDaysAhead"],
    [{ capacity: Number.NaN }, "capacity"],
  ] as const)("%o is a problem with %s", (change, field) => {
    expect(checkSlotRules({ ...ownerRules, ...change })).toEqual([{ field }]);
  });

  test("the ends of each range are allowed", () => {
    expect(checkSlotRules({ slotMinutes: 15, capacity: 1, minDaysAhead: 0, maxDaysAhead: 0 })).toEqual([]);
    expect(checkSlotRules({ slotMinutes: 480, capacity: 50, minDaysAhead: 60, maxDaysAhead: 60 })).toEqual([]);
  });

  test("invalid rules give no days at all", () => {
    expect(availableSlots(schedule({ rules: { ...ownerRules, slotMinutes: 0 } }), noneReserved, now)).toEqual([]);
  });
});

describe("checkSlotRequest", () => {
  test.each([
    ["10:00 on Thursday 29 Oct", "2026-10-29T04:30:00Z"],
    ["18:00 on Wednesday 4 Nov, the last slot in the window", "2026-11-04T12:30:00Z"],
  ])("%s can be booked", (_, instant) => {
    expect(checkSlotRequest(schedule(), at(instant), now)).toBeNull();
  });

  test.each([
    ["10:30, between two slots", "2026-10-29T05:00:00Z"],
    ["10:00 and one second", "2026-10-29T04:30:01Z"],
    ["10:00 and one millisecond", "2026-10-29T04:30:00.001Z"],
    ["19:00, closing time", "2026-10-29T13:30:00Z"],
    ["09:00, before opening", "2026-10-29T03:30:00Z"],
    ["10:00 on Monday 2 Nov, the closed day", "2026-11-02T04:30:00Z"],
  ])("%s is not a slot", (_, instant) => {
    expect(checkSlotRequest(schedule(), at(instant), now)).toBe("not-a-slot");
  });

  test("an Invalid Date is not a slot", () => {
    expect(checkSlotRequest(schedule(), new Date("not a date"), now)).toBe("not-a-slot");
  });

  test.each([
    ["18:00 today (no same-day booking)", "2026-10-28T12:30:00Z"],
    ["10:00 on Thursday 5 Nov, 8 days ahead", "2026-11-05T04:30:00Z"],
    ["10:00 yesterday", "2026-10-27T04:30:00Z"],
  ])("%s is outside the window", (_, instant) => {
    expect(checkSlotRequest(schedule(), at(instant), now)).toBe("outside-window");
  });

  test("a slot on a closed date is refused as a closed date", () => {
    const closed = schedule({ closedDates: new Set(["2026-10-31"]) });
    expect(checkSlotRequest(closed, at("2026-10-31T04:30:00Z"), now)).toBe("closed-date");
  });

  test("uses India's date: at 00:01 on 29 Oct in India, the 29th is today", () => {
    const justAfterMidnight = at("2026-10-28T18:31:00Z");
    expect(checkSlotRequest(schedule(), at("2026-10-29T04:30:00Z"), justAfterMidnight)).toBe("outside-window");
    expect(checkSlotRequest(schedule(), at("2026-10-30T04:30:00Z"), justAfterMidnight)).toBeNull();
  });

  test("invalid rules make nothing bookable", () => {
    const broken = schedule({ rules: { ...ownerRules, capacity: 0 } });
    expect(checkSlotRequest(broken, at("2026-10-29T04:30:00Z"), now)).toBe("not-a-slot");
  });

  test("10:30 on a day past the window is outside the window (the window is checked first)", () => {
    expect(checkSlotRequest(schedule(), at("2026-11-05T05:00:00Z"), now)).toBe("outside-window");
  });

  test.each([
    ["the owner's rules", ownerRules, now],
    // Same-day booking at 13:00 exactly (07:30Z): the 13:00 slot has started.
    ["same-day booking, at a slot's start", { ...ownerRules, minDaysAhead: 0 }, at("2026-10-28T07:30:00Z")],
  ])("agrees with availableSlots on every slot in the window (%s)", (_, rules, moment) => {
    const days = availableSlots(schedule({ rules }), noneReserved, moment);
    for (const day of days) {
      if (day.status !== "open") continue;
      for (const slot of day.slots) expect(checkSlotRequest(schedule({ rules }), slot.startsAt, moment)).toBeNull();
    }
  });
});

describe("checkSlotRequest with same-day booking (if the owner ever allows it)", () => {
  const sameDay = schedule({ rules: { ...ownerRules, minDaysAhead: 0 } });
  // 12:20 on Wednesday 28 Oct in India.
  const midday = at("2026-10-28T06:50:00Z");

  test("a slot that started earlier today is outside the window", () => {
    // 11:00 today.
    expect(checkSlotRequest(sameDay, at("2026-10-28T05:30:00Z"), midday)).toBe("outside-window");
  });

  test("the 12:00 slot, which started 20 minutes ago, is outside the window", () => {
    expect(checkSlotRequest(sameDay, at("2026-10-28T06:30:00Z"), midday)).toBe("outside-window");
  });

  test("a slot starting exactly now is outside the window", () => {
    // 13:00 today, asked at 13:00.
    expect(checkSlotRequest(sameDay, at("2026-10-28T07:30:00Z"), at("2026-10-28T07:30:00Z"))).toBe("outside-window");
  });

  test("a later slot today can be booked", () => {
    // 13:00 today.
    expect(checkSlotRequest(sameDay, at("2026-10-28T07:30:00Z"), midday)).toBeNull();
  });

  test("availableSlots leaves out a slot starting exactly now", () => {
    const days = availableSlots(sameDay, noneReserved, at("2026-10-28T07:30:00Z"));
    expect(startTimes(days[0])[0]).toBe("14:00");
  });
});
