// Indian vehicle registration numbers: the shapes the site accepts, the one
// form they're stored in, and how they're shown.
//
// Two shapes, as people type them (any case, with or without spaces, "-" or
// "."):
// - a state series: STATE (2 letters) + RTO (1-2 digits) + SERIES (1-3
//   letters) + NUMBER (1-4 digits): "MH 12 AB 1234", "DL 3 CAB 0042";
// - the Bharat series (since 2021, for people who move between states): YY
//   (the year, 21 or later) + "BH" + NUMBER (1-4 digits) + 1-2 letters:
//   "22 BH 1234 AB".
// The number is stored with four digits ("MH12AB1" is "MH12AB0001"), so one
// plate is never saved twice in two forms.
//
// Refused on purpose, with a message that points to the garage's phone:
// plates with no series letters (with none, "MH12123" could be RTO 12 or
// RTO 1), the pre-1989 three-letter series ("MHF 1234"), temporary and
// trade plates, and diplomatic and military plates. Per-state RTO ranges
// aren't checked: they change as RTOs open, and a wrong range refuses real
// plates.

export type RegistrationProblem = "registration-missing" | "registration-unknown-state" | "registration-invalid";

/**
 * Every state and union territory code, old ones included (OR and OD, UA
 * and UK, TS and TG...): the set is closed, and it catches typos like "MX".
 */
export const STATE_CODES = [
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN",
  "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
  "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB", "PY",
  "RJ", "SK", "TG", "TN", "TR", "TS", "UA", "UK", "UP", "WB",
] as const;

/** Longest input looked at: a typed plate with generous spacing fits easily. */
const MAX_TYPED_LENGTH = 20;

const STATE_SERIES = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;
const BHARAT_SERIES = /^(\d{2})BH(\d{1,4})([A-Z]{1,2})$/;
/** The first Bharat series year: the series began in 2021. */
const FIRST_BHARAT_YEAR = 21;

type Parts =
  | { kind: "state"; state: string; rto: string; series: string; number: string }
  | { kind: "bharat"; year: string; number: string; series: string };

/** The parts of a compact registration, or null when it has neither shape. */
function partsOf(compact: string): Parts | null {
  const state = STATE_SERIES.exec(compact);
  if (state) {
    const [, code, rto, series, number] = state;
    return { kind: "state", state: code, rto, series, number: number.padStart(4, "0") };
  }
  const bharat = BHARAT_SERIES.exec(compact);
  if (bharat && Number(bharat[1]) >= FIRST_BHARAT_YEAR) {
    const [, year, number, series] = bharat;
    return { kind: "bharat", year, number: number.padStart(4, "0"), series };
  }
  return null;
}

function compactOf(parts: Parts): string {
  return parts.kind === "state"
    ? `${parts.state}${parts.rto}${parts.series}${parts.number}`
    : `${parts.year}BH${parts.number}${parts.series}`;
}

function displayOf(parts: Parts): string {
  return parts.kind === "state"
    ? `${parts.state} ${parts.rto} ${parts.series} ${parts.number}`
    : `${parts.year} BH ${parts.number} ${parts.series}`;
}

/**
 * What someone typed, as a registration number: its stored (compact) form
 * and how it's shown, or the problem with it.
 */
export function parseRegistration(
  typed: string,
): { ok: true; compact: string; display: string } | { ok: false; problem: RegistrationProblem } {
  if (typed.trim() === "") return { ok: false, problem: "registration-missing" };
  if (typed.length > MAX_TYPED_LENGTH) return { ok: false, problem: "registration-invalid" };
  const cleaned = typed.trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!/^[A-Z0-9]+$/.test(cleaned)) return { ok: false, problem: "registration-invalid" };
  const parts = partsOf(cleaned);
  if (!parts) return { ok: false, problem: "registration-invalid" };
  if (parts.kind === "state" && !(STATE_CODES as readonly string[]).includes(parts.state)) {
    return { ok: false, problem: "registration-unknown-state" };
  }
  return { ok: true, compact: compactOf(parts), display: displayOf(parts) };
}

/**
 * A stored registration, grouped for reading: "MH 12 AB 1234",
 * "22 BH 1234 AB". Anything else is shown as it is (display never throws).
 */
export function formatRegistration(compact: string): string {
  const parts = partsOf(compact);
  return parts ? displayOf(parts) : compact;
}
