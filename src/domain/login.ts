// The rules of logging in with a code sent by SMS, in one place, so task 44
// can tune them once real SMS costs money.

import { toAsciiDigits } from "@/lib/contact-links";

export const LOGIN_RULES = {
  /** Digits in a code. */
  codeLength: 6,
  /** How long a code works: 5 minutes. */
  codeLifetimeSeconds: 5 * 60,
  /** Wrong tries a code allows. The next try kills it. */
  wrongTriesAllowed: 3,
  /** The wait before "Send a new code" works again. */
  resendWaitSeconds: 30,
  /** SMS per number, per rolling hour and per rolling day. */
  sendsPerNumberPerHour: 5,
  sendsPerNumberPerDay: 10,
  /** SMS per connection (IP address) per rolling hour, where the IP is known. */
  sendsPerIpPerHour: 30,
  /** How long a login lasts: 30 days, never extended by visits. */
  sessionDays: 30,
  /** How long login attempts and fake messages are kept. */
  keepRecordsHours: 48,
} as const;

const DIGITS_ONLY = new RegExp(`^\\d{${LOGIN_RULES.codeLength}}$`);

/**
 * What someone typed as the code, as 6 ASCII digits, or null. Spaces and
 * dashes are dropped ("123 456" from a pasted SMS) and Devanagari digits
 * become ASCII.
 */
export function parseLoginCode(typed: string): string | null {
  const compact = toAsciiDigits(typed).replace(/[\s-]/g, "");
  return DIGITS_ONLY.test(compact) ? compact : null;
}

/** Where the form asks for a code: the phone step, or "Send a new code". */
export type SendIntent = "start" | "resend";

/** What the database knows about a number before a send. */
export type SendHistory = {
  /** When each SMS went to this number in the last day. */
  sentToNumber: readonly Date[];
  /** When each SMS went from this IP in the last hour, or null when the IP isn't known (local runs). */
  sentFromIp: readonly Date[] | null;
  /** The number's newest code, if Better Auth still has one. */
  liveCode: { expiresAt: Date; triesLeft: number } | null;
};

export type SendDecision =
  /** Send a code. "Send a new code" works again at resendAt. */
  | { outcome: "send"; resendAt: Date }
  /** The phone step, with a code still usable: no SMS, go to the code step. */
  | { outcome: "alreadySent"; resendAt: Date }
  /** Under 30 seconds since the last SMS: try again at retryAt. */
  | { outcome: "tooSoon"; retryAt: Date }
  /** A limit is reached: try again at retryAt. */
  | { outcome: "rateLimited"; retryAt: Date };

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

/**
 * When a limit of `max` sends per `window` allows the next one, or null when
 * it allows one now. `times` may hold sends older than the window.
 */
function limitLiftsAt(times: readonly Date[], max: number, window: number, now: Date): Date | null {
  const inWindow = times
    .map((time) => time.getTime())
    .filter((time) => time > now.getTime() - window)
    .sort((a, b) => a - b);
  if (inWindow.length < max) return null;
  // The send that has to leave the window before the count drops below max.
  return new Date(inWindow[inWindow.length - max] + window);
}

/**
 * Whether a code may be sent now. Pure: the history comes from the
 * database, `now` from a Clock. It never asks whether the number has an
 * account, so the answers can't reveal it.
 */
export function decideSend(history: SendHistory, intent: SendIntent, now: Date): SendDecision {
  const lastSend = history.sentToNumber.reduce<number | null>(
    (latest, time) => (latest === null || time.getTime() > latest ? time.getTime() : latest),
    null,
  );
  const waitEnds = lastSend === null ? null : new Date(lastSend + LOGIN_RULES.resendWaitSeconds * SECOND);
  const { liveCode } = history;
  const usable = liveCode !== null && liveCode.expiresAt > now && liveCode.triesLeft > 0;

  // The phone step never kills a code someone may be holding (a reload, a
  // second tab): it goes to the code step instead. Only "Send a new code" does.
  if (intent === "start" && usable) {
    return { outcome: "alreadySent", resendAt: waitEnds && waitEnds > now ? waitEnds : now };
  }
  if (waitEnds && waitEnds > now) return { outcome: "tooSoon", retryAt: waitEnds };

  const lifts = [
    limitLiftsAt(history.sentToNumber, LOGIN_RULES.sendsPerNumberPerHour, HOUR, now),
    limitLiftsAt(history.sentToNumber, LOGIN_RULES.sendsPerNumberPerDay, DAY, now),
    history.sentFromIp && limitLiftsAt(history.sentFromIp, LOGIN_RULES.sendsPerIpPerHour, HOUR, now),
  ].filter((time): time is Date => time !== null);
  if (lifts.length > 0) {
    return { outcome: "rateLimited", retryAt: new Date(Math.max(...lifts.map((time) => time.getTime()))) };
  }
  return { outcome: "send", resendAt: new Date(now.getTime() + LOGIN_RULES.resendWaitSeconds * SECOND) };
}

/**
 * The key an IP address is limited by. IPv4 as it is. IPv6 by its first
 * half (the /64 network): one home or phone gets a whole /64, and can pick
 * any address in it. "::ffff:1.2.3.4" (IPv4 written as IPv6) is IPv4.
 * Returns null for anything that isn't an IP address.
 */
export function ipLimitKey(address: string): string | null {
  const ip = address.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  const v4 = mapped ? mapped[1] : ip;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v4)) {
    return v4.split(".").every((part) => Number(part) <= 255) ? v4 : null;
  }
  if (!/^[0-9a-f:]+$/.test(ip) || !ip.includes(":")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
