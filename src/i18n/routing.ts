import { defineRouting } from "next-intl/routing";

import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // English URLs stay clean ("/", "/services"). Other languages get a prefix
  // ("/hi/services"), and "/en/..." redirects to the unprefixed URL.
  localePrefix: "as-needed",
});
