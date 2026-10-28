// The rules of logging in with a code sent by SMS, in one place, so task 44
// can tune them once real SMS costs money.

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
