// Money typed by people: the staff price editor (task 39) and, later, other
// staff screens that take an amount (task 28's pickup fees).
//
// Pure logic: no Next.js, React or database imports. Money is stored and
// passed as integer paise (₹1 = 100 paise) and shown with formatRupees().

/**
 * The amounts a price may be (owner, 2026-11-20): whole rupees from ₹1 to
 * ₹10,00,000, in paise. The top is far below the database column's limit
 * (about ₹2.1 crore), and high enough for any single job at the garage.
 */
export const PRICE_RULES = {
  minPaise: 100,
  maxPaise: 100_000_000,
} as const;

export type RupeesProblem = "blank" | "not-a-number" | "not-whole" | "too-small" | "too-large";

export type ParsedRupees = { ok: true; paise: number } | { ok: false; problem: RupeesProblem };

/** Whole rupees, commas only between digits: "1500", "1,500", "1,23,456". */
const WHOLE = /^\d+(,\d+)*$/;
/** The same with a decimal part: "1500.50", "1.500" (a dot typed for a comma), "1500.". */
const DECIMAL = /^\d+(,\d+)*\.\d*$/;

/**
 * Whole rupees typed by staff, as paise. Accepts an optional leading "₹",
 * spaces around it, and commas between digits (Indian or Western grouping).
 * Refuses paise ("1500.50", and so "1.500" typed for fifteen hundred), signs,
 * letters and other digits (Devanagari waits for the Hindi task).
 */
export function parseRupees(typed: string): ParsedRupees {
  const text = typed.trim().replace(/^₹\s*/, "");
  if (text === "") return { ok: false, problem: "blank" };
  if (DECIMAL.test(text)) return { ok: false, problem: "not-whole" };
  if (!WHOLE.test(text)) return { ok: false, problem: "not-a-number" };

  const digits = text.replaceAll(",", "").replace(/^0+(?=\d)/, "");
  // More digits than the limit has: too large, without trusting a float.
  if (digits.length > String(PRICE_RULES.maxPaise / 100).length) return { ok: false, problem: "too-large" };
  const paise = Number(digits) * 100;
  if (paise < PRICE_RULES.minPaise) return { ok: false, problem: "too-small" };
  if (paise > PRICE_RULES.maxPaise) return { ok: false, problem: "too-large" };
  return { ok: true, paise };
}
