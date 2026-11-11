// A customer's profile: the name they give once, right after their first
// login (the owner's choice, 2026-10-29). Pure rules; the data-access layer
// stores the name in users.name, which Better Auth leaves empty at sign-up.

export type NameProblem = "name-missing" | "name-too-short" | "name-too-long" | "name-invalid";

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;

/** Letters and marks of any script, spaces, ".", "'" (or the curly ’ phones type) and "-". */
const NAME_CHARACTERS = /^[\p{L}\p{M} .'’-]+$/u;
const A_LETTER = /\p{L}/u;

/** Trims the name and collapses runs of spaces: "  asha   patil " is "asha patil". */
export function normalizeName(typed: string): string {
  return typed.trim().replace(/\s+/g, " ");
}

/** The name to store, or the problem with it. Lengths count characters, not bytes. */
export function checkName(typed: string): { ok: true; name: string } | { ok: false; problem: NameProblem } {
  const name = normalizeName(typed);
  const length = [...name].length;
  if (length === 0) return { ok: false, problem: "name-missing" };
  if (length < NAME_MIN_LENGTH) return { ok: false, problem: "name-too-short" };
  if (length > NAME_MAX_LENGTH) return { ok: false, problem: "name-too-long" };
  if (!NAME_CHARACTERS.test(name) || !A_LETTER.test(name)) return { ok: false, problem: "name-invalid" };
  return { ok: true, name };
}

/** Whether the customer still has to give their name (it's empty or blank). */
export function needsName(profile: { name: string }): boolean {
  return normalizeName(profile.name) === "";
}
