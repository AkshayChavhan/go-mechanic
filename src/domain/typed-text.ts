// Text people type into a box with several lines (an estimate request's
// description, a job update's note), cleaned the same way before it's
// checked and stored.
//
// Pure logic: no Next.js, React or database imports.

/**
 * The text as stored: trimmed, NUL characters dropped, Windows line breaks
 * made plain, and spaces at the end of each line removed. Line breaks inside
 * are kept: a customer may list symptoms one per line.
 */
export function normalizeTypedText(typed: string): string {
  return typed
    // NUL can't be stored in Postgres text (error 22021); only a hand-made post sends one.
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Its length in characters, not bytes or UTF-16 units: an emoji counts once. */
export function typedLength(text: string): number {
  return [...text].length;
}
