// Errors from the login code, without their details.
//
// A database error's message holds the query's values: phone numbers, login
// codes, session tokens. Next.js logs every error a Server Action or a page
// throws, so letting one through would write those values to the logs.
// withoutDetails runs a step and turns any unexpected error into a
// LoginServiceError that keeps only what helps debugging and names nobody:
// the step, the error's name and, for a database error, its Postgres code.

import "server-only";

import { unstable_rethrow } from "next/navigation";

/** Thrown instead of an unexpected error: it names the step and the kind of error, nothing else. */
export class LoginServiceError extends Error {
  constructor(step: string, kind: string) {
    super(`${step} failed (${kind})`);
    this.name = "LoginServiceError";
  }
}

/** "DrizzleQueryError 23505": the error's name and, for a database error, its Postgres code. */
export function kindOf(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const pgCode = (error.cause as { code?: unknown } | undefined)?.code ?? (error as { code?: unknown }).code;
  return typeof pgCode === "string" && /^[0-9A-Z]{5}$/.test(pgCode) ? `${error.name} ${pgCode}` : error.name;
}

/**
 * Runs a step and turns any unexpected error into a LoginServiceError with
 * no message or cause from the original. Next.js's own signals (redirect(),
 * notFound(), a page pausing for request data) pass through first, unchanged.
 */
export async function withoutDetails<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof LoginServiceError) throw error;
    throw new LoginServiceError(step, kindOf(error));
  }
}
