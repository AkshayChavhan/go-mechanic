// The SMS that carries a login code, in the language of the page that asked
// for it. The words live in messages/en.json ("Sms"), like every other text.

import "server-only";

import { getTranslations } from "next-intl/server";

import { LOGIN_RULES } from "@/domain/login";
import type { Locale } from "@/i18n/config";

export async function loginCodeText(locale: Locale, code: string): Promise<string> {
  const [t, tBrand] = await Promise.all([
    getTranslations({ locale, namespace: "Sms" }),
    getTranslations({ locale, namespace: "Brand" }),
  ]);
  return t("loginCode", {
    code,
    brand: tBrand("name"),
    minutes: String(LOGIN_RULES.codeLifetimeSeconds / 60),
  });
}
