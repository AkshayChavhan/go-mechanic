import { afterEach, describe, expect, test } from "vitest";

import {
  checkDayHours,
  checkWeeklyHours,
  groupWeeklyHours,
  isOpenAt,
  minutesAfterMidnight,
  openStatusAt,
  type WeeklyHours,
} from "./opening-hours";

// Every instant below is written in UTC (the "Z" at the end), with the India
// time it stands for in a comment. India is 5 hours 30 minutes ahead of UTC.
// 26 Oct 2026 is a Monday.

/** The garage's real hours (src/content/garage.ts), copied so U2 stands alone. */
const garageHours: WeeklyHours = {
  monday: "closed",
  tuesday: { opens: "10:00", closes: "19:00" },
  wednesday: { opens: "10:00", closes: "19:00" },
  thursday: { opens: "10:00", closes: "19:00" },
  friday: { opens: "10:00", closes: "19:00" },
  saturday: { opens: "10:00", closes: "19:00" },
  sunday: { opens: "10:00", closes: "19:00" },
};

const at = (iso: string) => new Date(iso);

describe("the test setup", () => {
  test("runs in UTC (vitest.config.mts), so a computer set to India time can't hide a bug", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(at("2026-10-26T00:00:00Z").getHours()).toBe(0);
  });
});

describe("openStatusAt (is the garage open, and if not, when does it open?)", () => {
  test.each([
    ["00:00", "2026-10-25T18:30:00Z"],
    ["12:00", "2026-10-26T06:30:00Z"],
    ["23:59", "2026-10-26T18:29:00Z"],
  ])("Monday %s IST: closed all day, opens tomorrow (Tuesday) at 10:00", (_india, utc) => {
    expect(openStatusAt(garageHours, at(utc))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-10-27T04:30:00Z"), when: "tomorrow", weekday: "tuesday" },
    });
  });

  test("Tuesday 09:59:59 IST: closed, opens today at 10:00", () => {
    expect(openStatusAt(garageHours, at("2026-10-27T04:29:59Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-10-27T04:30:00Z"), when: "today", weekday: "tuesday" },
    });
  });

  test("Tuesday 10:00:00 IST: open (opening time counts as open), closes at 19:00", () => {
    expect(openStatusAt(garageHours, at("2026-10-27T04:30:00Z"))).toEqual({
      isOpen: true,
      closesAt: at("2026-10-27T13:30:00Z"),
    });
  });

  test("Tuesday 18:59:59 IST: still open", () => {
    expect(openStatusAt(garageHours, at("2026-10-27T13:29:59Z"))).toEqual({
      isOpen: true,
      closesAt: at("2026-10-27T13:30:00Z"),
    });
  });

  test("Tuesday 19:00:00 IST: closed (closing time counts as closed), opens tomorrow", () => {
    expect(openStatusAt(garageHours, at("2026-10-27T13:30:00Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-10-28T04:30:00Z"), when: "tomorrow", weekday: "wednesday" },
    });
  });

  test("Sunday 19:30 IST: Monday is closed, so it opens later, on Tuesday", () => {
    // Sunday 1 Nov 19:30 IST -> Tuesday 3 Nov 10:00 IST
    expect(openStatusAt(garageHours, at("2026-11-01T14:00:00Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-11-03T04:30:00Z"), when: "later", weekday: "tuesday" },
    });
  });

  test("uses India's day, not UTC's: Monday 20:00 UTC is already Tuesday 01:30 IST", () => {
    expect(openStatusAt(garageHours, at("2026-10-26T20:00:00Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-10-27T04:30:00Z"), when: "today", weekday: "tuesday" },
    });
  });

  test("uses India's time, not UTC's: Sunday 13:29 UTC is 18:59 IST, so open", () => {
    expect(openStatusAt(garageHours, at("2026-11-01T13:29:00Z"))).toEqual({
      isOpen: true,
      closesAt: at("2026-11-01T13:30:00Z"),
    });
  });

  test("looks up to seven days ahead: open only on Tuesdays, asked after Tuesday's closing", () => {
    const tuesdaysOnly: WeeklyHours = { ...closedAllWeek(), tuesday: { opens: "10:00", closes: "19:00" } };
    // Tuesday 27 Oct 19:30 IST -> Tuesday 3 Nov 10:00 IST
    expect(openStatusAt(tuesdaysOnly, at("2026-10-27T14:00:00Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-11-03T04:30:00Z"), when: "later", weekday: "tuesday" },
    });
  });

  test("a week with no open day: never open, and no next opening", () => {
    for (const utc of ["2026-10-26T06:30:00Z", "2026-10-27T06:30:00Z", "2026-11-01T06:30:00Z"]) {
      expect(isOpenAt(closedAllWeek(), at(utc))).toBe(false);
      expect(openStatusAt(closedAllWeek(), at(utc))).toEqual({ isOpen: false, nextOpening: null });
    }
  });

  test("a day with broken hours (closes before it opens) counts as closed instead of throwing", () => {
    const broken: WeeklyHours = { ...garageHours, tuesday: { opens: "19:00", closes: "10:00" } };
    // Tuesday 27 Oct 12:00 IST
    expect(openStatusAt(broken, at("2026-10-27T06:30:00Z"))).toEqual({
      isOpen: false,
      nextOpening: { at: at("2026-10-28T04:30:00Z"), when: "tomorrow", weekday: "wednesday" },
    });
  });
});

describe("the answer doesn't depend on the computer's own time zone", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    // Setting process.env.TZ = undefined would store the text "undefined".
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  const instants = [
    "2026-10-26T06:30:00Z", // Monday 12:00 IST
    "2026-10-27T04:29:59Z", // Tuesday 09:59:59 IST
    "2026-10-27T04:30:00Z", // Tuesday 10:00 IST
    "2026-10-27T13:30:00Z", // Tuesday 19:00 IST
    "2026-10-26T20:00:00Z", // Monday in UTC, Tuesday 01:30 IST
    "2026-11-01T14:00:00Z", // Sunday 19:30 IST
  ];

  test.each(["Asia/Kolkata", "America/New_York"])("same answers with TZ=%s", (timeZone) => {
    const inUtc = instants.map((utc) => openStatusAt(garageHours, at(utc)));
    process.env.TZ = timeZone;
    expect(at("2026-10-26T00:00:00Z").getHours()).not.toBe(0); // the change took effect
    expect(instants.map((utc) => openStatusAt(garageHours, at(utc)))).toEqual(inUtc);
  });
});

describe("isOpenAt", () => {
  test("agrees with openStatusAt", () => {
    expect(isOpenAt(garageHours, at("2026-10-27T04:30:00Z"))).toBe(true); // Tuesday 10:00 IST
    expect(isOpenAt(garageHours, at("2026-10-27T13:30:00Z"))).toBe(false); // Tuesday 19:00 IST
    expect(isOpenAt(garageHours, at("2026-10-26T06:30:00Z"))).toBe(false); // Monday 12:00 IST
  });
});

describe("minutesAfterMidnight", () => {
  test("reads 24-hour HH:MM", () => {
    expect(minutesAfterMidnight("00:00")).toBe(0);
    expect(minutesAfterMidnight("10:30")).toBe(630);
    expect(minutesAfterMidnight("23:59")).toBe(1439);
  });

  test("gives null for anything else", () => {
    expect(minutesAfterMidnight("24:00")).toBeNull();
    expect(minutesAfterMidnight("7pm")).toBeNull();
  });
});

describe("checkDayHours and checkWeeklyHours (validation, for admin saves later)", () => {
  test("accepts a closed day and normal hours", () => {
    expect(checkDayHours("closed")).toBeNull();
    expect(checkDayHours({ opens: "10:00", closes: "19:00" })).toBeNull();
    expect(checkDayHours({ opens: "00:00", closes: "23:59" })).toBeNull();
  });

  test.each([
    ["closing at the opening time", "10:00", "10:00"],
    ["closing before opening", "19:00", "10:00"],
    ["overnight hours", "22:00", "02:00"],
  ])("rejects %s", (_case, opens, closes) => {
    expect(checkDayHours({ opens, closes })).toBe("closes-before-opening");
  });

  test.each(["9:00", "24:00", "10:60", "10:00:00", "ab:cd", "", " 10:00"])(
    "rejects %j: not HH:MM within 00:00-23:59",
    (time) => {
      expect(checkDayHours({ opens: time, closes: "19:00" })).toBe("invalid-time");
      expect(checkDayHours({ opens: "08:00", closes: time })).toBe("invalid-time");
    },
  );

  test("checkWeeklyHours lists each day with a problem", () => {
    expect(checkWeeklyHours(garageHours)).toEqual([]);
    const broken: WeeklyHours = {
      ...garageHours,
      wednesday: { opens: "19:00", closes: "10:00" },
      sunday: { opens: "10:00", closes: "7pm" },
    };
    expect(checkWeeklyHours(broken)).toEqual([
      { weekday: "wednesday", problem: "closes-before-opening" },
      { weekday: "sunday", problem: "invalid-time" },
    ]);
  });
});

describe("groupWeeklyHours (for the footer's hours list)", () => {
  test("the garage's week makes two groups: Monday closed, Tuesday to Sunday 10:00-19:00", () => {
    expect(groupWeeklyHours(garageHours)).toEqual([
      { from: "monday", to: "monday", hours: "closed" },
      { from: "tuesday", to: "sunday", hours: { opens: "10:00", closes: "19:00" } },
    ]);
  });

  test("only joins days that sit next to each other, starting from Monday", () => {
    const weekdaysOnly: WeeklyHours = {
      ...garageHours,
      monday: { opens: "10:00", closes: "19:00" },
      saturday: { opens: "10:00", closes: "14:00" },
      sunday: "closed",
    };
    expect(groupWeeklyHours(weekdaysOnly)).toEqual([
      { from: "monday", to: "friday", hours: { opens: "10:00", closes: "19:00" } },
      { from: "saturday", to: "saturday", hours: { opens: "10:00", closes: "14:00" } },
      { from: "sunday", to: "sunday", hours: "closed" },
    ]);
  });
});

function closedAllWeek(): WeeklyHours {
  return {
    monday: "closed",
    tuesday: "closed",
    wednesday: "closed",
    thursday: "closed",
    friday: "closed",
    saturday: "closed",
    sunday: "closed",
  };
}
