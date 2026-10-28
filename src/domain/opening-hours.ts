// Opening hours: is the garage open at a given moment, and if not, when does
// it open next?
//
// Pure logic: no Next.js, React or next-intl imports, so it runs anywhere
// (server, browser, tests) and task 14's database can reuse these types.
//
// The garage runs on India time, but servers usually run in UTC and a visitor
// may be abroad. So every function here reads the India wall-clock time
// through the helpers in india-time.ts. Never the computer's own clock
// (date.getHours()) and never a typed "+05:30".

import { indiaInstant, indiaWallClockAt, weekdayIndex } from "./india-time";

/** The days of the week, Monday first (the order the footer lists them in). */
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * One day's hours: "closed", or an opening and closing time on the same day,
 * as 24-hour "HH:MM" text ("10:00", "19:00"). The garage is open from `opens`
 * (included) up to `closes` (not included): at 19:00:00 it's closed.
 * Overnight hours (22:00 to 02:00) aren't supported; checkDayHours rejects them.
 */
export type DayHours = "closed" | { opens: string; closes: string };

/** A full week of hours, one entry per day. */
export type WeeklyHours = Record<Weekday, DayHours>;

/** When the garage next opens, if it's closed now. */
export type NextOpening = {
  /** The exact moment it opens. */
  at: Date;
  /** "today" (later today, India time), "tomorrow", or "later" (2 to 7 days away). */
  when: "today" | "tomorrow" | "later";
  /** The India weekday it opens on, for "Opens Tue at 10:00 am". */
  weekday: Weekday;
};

export type OpenStatus =
  | { isOpen: true; closesAt: Date }
  // nextOpening is null when no day of the week has hours.
  | { isOpen: false; nextOpening: NextOpening | null };

/** Why a day's hours are wrong. Codes, not sentences, so a form can translate them. */
export type HoursProblem = "invalid-time" | "closes-before-opening";

// "00:00" to "23:59": two-digit hour, two-digit minute.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "10:30" -> 630 (minutes after midnight), or null if it isn't valid "HH:MM". */
export function minutesAfterMidnight(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** What's wrong with one day's hours, or null when they're fine. */
export function checkDayHours(day: DayHours): HoursProblem | null {
  if (day === "closed") return null;
  const opens = minutesAfterMidnight(day.opens);
  const closes = minutesAfterMidnight(day.closes);
  if (opens === null || closes === null) return "invalid-time";
  if (closes <= opens) return "closes-before-opening";
  return null;
}

/** Every day of the week whose hours are wrong (an empty list means all fine). */
export function checkWeeklyHours(hours: WeeklyHours): { weekday: Weekday; problem: HoursProblem }[] {
  return WEEKDAYS.flatMap((weekday) => {
    const problem = checkDayHours(hours[weekday]);
    return problem ? [{ weekday, problem }] : [];
  });
}

/**
 * A day's hours in minutes after midnight, or null when the garage is closed.
 * Hours that fail checkDayHours also count as closed: this runs while a page
 * renders, where a wrong "Closed" is better than a crash. Admin saves
 * (tasks 28 and 40) call checkDayHours so bad hours never get stored.
 * The slot engine (slots.ts) uses it too, so a bad day has no slots.
 */
export function openMinutes(day: DayHours): { opens: number; closes: number } | null {
  // The same rules as a save, from one place: a rule added to checkDayHours
  // (a lunch break, say) reaches the badge too.
  if (day === "closed" || checkDayHours(day) !== null) return null;
  // checkDayHours has just confirmed both times are valid "HH:MM".
  return { opens: minutesAfterMidnight(day.opens) as number, closes: minutesAfterMidnight(day.closes) as number };
}

/** Whether the garage is open at `instant` (India time). */
export function isOpenAt(hours: WeeklyHours, instant: Date): boolean {
  return openStatusAt(hours, instant).isOpen;
}

/**
 * Whether the garage is open at `instant` (India time) and, if it is, when it
 * closes; if it isn't, when it next opens (looking up to seven days ahead).
 */
export function openStatusAt(hours: WeeklyHours, instant: Date): OpenStatus {
  const now = indiaWallClockAt(instant);
  const nowMinutes = now.hour * 60 + now.minute;
  const todayIndex = weekdayIndex(now);
  const today = openMinutes(hours[WEEKDAYS[todayIndex]]);

  if (today && today.opens <= nowMinutes && nowMinutes < today.closes) {
    return { isOpen: true, closesAt: indiaInstant(now, 0, today.closes) };
  }

  if (today && nowMinutes < today.opens) {
    return {
      isOpen: false,
      nextOpening: { at: indiaInstant(now, 0, today.opens), when: "today", weekday: WEEKDAYS[todayIndex] },
    };
  }

  // Tomorrow, the day after, ... up to the same weekday next week.
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const weekday = WEEKDAYS[(todayIndex + daysAhead) % 7];
    const day = openMinutes(hours[weekday]);
    if (day) {
      return {
        isOpen: false,
        nextOpening: {
          at: indiaInstant(now, daysAhead, day.opens),
          when: daysAhead === 1 ? "tomorrow" : "later",
          weekday,
        },
      };
    }
  }

  return { isOpen: false, nextOpening: null };
}

/** A run of days in a row with the same hours: Tuesday to Sunday, 10:00 to 19:00. */
export type HoursGroup = { from: Weekday; to: Weekday; hours: DayHours };

function sameHours(a: DayHours, b: DayHours): boolean {
  if (a === "closed" || b === "closed") return a === b;
  return a.opens === b.opens && a.closes === b.closes;
}

/**
 * Joins days that sit next to each other and share the same hours, starting
 * from Monday, so the footer can say "Tuesday to Sunday" instead of six lines.
 * Sunday and Monday are never joined: the list always starts on Monday.
 */
export function groupWeeklyHours(hours: WeeklyHours): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const weekday of WEEKDAYS) {
    const last = groups.at(-1);
    if (last && sameHours(last.hours, hours[weekday])) {
      last.to = weekday;
    } else {
      groups.push({ from: weekday, to: weekday, hours: hours[weekday] });
    }
  }
  return groups;
}
