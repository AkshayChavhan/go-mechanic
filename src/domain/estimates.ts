// The garage's estimate for a booked job (task 33): a priced list of part and
// labour lines, each needed or optional, that staff send for the customer's
// approval.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/estimates.ts) checks what the add-line form posts with
// checkEstimateLineInput(), then fills a blank description or amount from the
// chosen service and checks against the database what only it can know (the
// service exists, the booking's state). canEditEstimate() says when the
// estimate may change at all.

import { type BookingStatus, isActiveStatus } from "./bookings";
import type { JobStatus } from "./jobs";
import { parseRupees, type RupeesProblem } from "./money";
import { normalizeTypedText, typedLength } from "./typed-text";
import { isTextId } from "./vehicles";

export const ESTIMATE_RULES = {
  /** Characters (code points, like Postgres char_length), after trimming. */
  descriptionMaxLength: 120,
} as const;

export const ESTIMATE_LINE_KINDS = ["part", "labour"] as const;
export type EstimateLineKind = (typeof ESTIMATE_LINE_KINDS)[number];

export function isEstimateLineKind(value: string): value is EstimateLineKind {
  return (ESTIMATE_LINE_KINDS as readonly string[]).includes(value);
}

/** What the add-line form posts, as strings. */
export type EstimateLineInput = {
  /** "part" or "labour". */
  kind: string;
  /** Blank only with a service: the service's name is used. */
  description: string;
  /** Whole rupees as typed ("1,500"). Blank only with a service: its real price is used. */
  amount: string;
  /** "needed" or "optional". */
  needed: string;
  /** A service's id, or blank for a line typed by hand. */
  serviceId: string;
};

export type EstimateLineInputProblem =
  | { field: "kind"; problem: "kind-missing" | "kind-unknown" }
  | { field: "needed"; problem: "needed-missing" | "needed-unknown" }
  | { field: "description"; problem: "description-missing" | "description-too-long" }
  | { field: "amount"; problem: "amount-missing" | Exclude<RupeesProblem, "blank"> }
  | { field: "form"; problem: "bad-request" };

export type CheckedEstimateLine = {
  kind: EstimateLineKind;
  /** Null: take the service's name (only when serviceId is set). */
  description: string | null;
  /** Null: take the service's real price (only when serviceId is set). */
  amountPaise: number | null;
  needed: boolean;
  serviceId: string | null;
};

/** The line to add, or every problem with it. */
export function checkEstimateLineInput(
  input: EstimateLineInput,
): { ok: true; line: CheckedEstimateLine } | { ok: false; problems: EstimateLineInputProblem[] } {
  const problems: EstimateLineInputProblem[] = [];

  const kind = input.kind.trim();
  if (kind === "") problems.push({ field: "kind", problem: "kind-missing" });
  else if (!isEstimateLineKind(kind)) problems.push({ field: "kind", problem: "kind-unknown" });

  const needed = input.needed.trim();
  if (needed === "") problems.push({ field: "needed", problem: "needed-missing" });
  else if (needed !== "needed" && needed !== "optional") problems.push({ field: "needed", problem: "needed-unknown" });

  const serviceId = input.serviceId.trim();
  const hasService = serviceId !== "";
  // Service ids come from the page's list; a malformed one is a hand-made post.
  if (hasService && !isTextId(serviceId)) problems.push({ field: "form", problem: "bad-request" });

  const description = normalizeTypedText(input.description);
  if (description === "" && !hasService) problems.push({ field: "description", problem: "description-missing" });
  if (typedLength(description) > ESTIMATE_RULES.descriptionMaxLength) {
    problems.push({ field: "description", problem: "description-too-long" });
  }

  // One parser for typed money on every staff screen (task 39).
  let amountPaise: number | null = null;
  if (input.amount.trim() === "") {
    if (!hasService) problems.push({ field: "amount", problem: "amount-missing" });
  } else {
    const parsed = parseRupees(input.amount);
    if (parsed.ok) amountPaise = parsed.paise;
    else if (parsed.problem !== "blank") problems.push({ field: "amount", problem: parsed.problem });
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    line: {
      kind: kind as EstimateLineKind,
      description: description === "" ? null : description,
      amountPaise,
      needed: needed === "needed",
      serviceId: hasService ? serviceId : null,
    },
  };
}

export type EstimateTotals = {
  neededPaise: number;
  optionalPaise: number;
  /** Needed and optional together. */
  totalPaise: number;
};

/** The sums an estimate shows, in paise, from its saved lines. */
export function estimateTotals(lines: readonly { amountPaise: number; needed: boolean }[]): EstimateTotals {
  let neededPaise = 0;
  let optionalPaise = 0;
  for (const line of lines) {
    if (line.needed) neededPaise += line.amountPaise;
    else optionalPaise += line.amountPaise;
  }
  return { neededPaise, optionalPaise, totalPaise: neededPaise + optionalPaise };
}

/** The job steps at which staff may edit and send an estimate. */
const ESTIMATE_STEPS: readonly JobStatus[] = ["inspection", "in-service", "awaiting-approval"];

/**
 * Whether staff may change or send this booking's estimate: the booking is
 * active (booked or confirmed) and the job is at inspection, in service or
 * awaiting approval. Otherwise the page shows the versions read-only.
 */
export function canEditEstimate(bookingStatus: BookingStatus, jobStatus: JobStatus | null): boolean {
  return isActiveStatus(bookingStatus) && jobStatus !== null && ESTIMATE_STEPS.includes(jobStatus);
}
