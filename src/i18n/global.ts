import type messages from "../../messages/en.json";
import type { Locale } from "./config";

// Type-checks message keys: t("titel") instead of t("title") fails
// `npm run typecheck`. English is the reference shape for every language.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
