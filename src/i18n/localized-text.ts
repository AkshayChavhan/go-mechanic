/**
 * Text that comes from the database (service names, FAQ answers...) in several
 * languages. English is required; other languages are optional.
 */
export type LocalizedText = {
  en: string;
  hi?: string;
};

/**
 * Picks the text for `locale`, falling back to English when that language is
 * missing, blank or not supported at all.
 */
export function localize(text: LocalizedText, locale: string): string {
  // Object.hasOwn: only keys stored on this object, so a locale such as
  // "constructor" (which every object inherits) falls back to English too.
  const translated = Object.hasOwn(text, locale)
    ? (text as Record<string, unknown>)[locale]
    : undefined;
  return typeof translated === "string" && translated.trim() !== "" ? translated : text.en;
}
