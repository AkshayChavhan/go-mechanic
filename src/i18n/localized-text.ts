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
  const translated = (text as Record<string, string | undefined>)[locale];
  return translated && translated.trim() !== "" ? translated : text.en;
}
