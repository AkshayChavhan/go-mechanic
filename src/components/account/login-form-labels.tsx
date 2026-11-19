import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import type { LoginFormLabels } from "./login-form";

/**
 * The login form's words, from the Login messages, for a server page to pass
 * to <LoginForm labels={...}> (/login) or to the booking wizard's login step
 * (/book): one place, so the two never drift apart. The form is a client
 * island and reads no messages itself. Templates the browser fills in
 * ({time}) are read raw. The privacy notice's link opens in a new tab, so
 * what was typed or chosen so far isn't lost.
 */
export async function loginFormLabels(): Promise<LoginFormLabels> {
  const t = await getTranslations("Login");
  const tBrand = await getTranslations("Brand");
  const privacy = (chunks: ReactNode) => (
    <Link href="/privacy" target="_blank" rel="noopener" className="text-link underline underline-offset-4">
      {chunks}
      <span className="sr-only"> {t("opensInNewTab")}</span>
    </Link>
  );
  return {
    phoneLabel: t("phoneLabel"),
    countryCode: t("countryCode"),
    phoneHint: t("phoneHint"),
    ageLabel: t("ageLabel"),
    consentLabel: t("consentLabel", { brand: tBrand("name") }),
    notice: t.rich("notice", { privacy }),
    sendCode: t("sendCode"),
    sending: t("sending"),
    codeLabel: t("codeLabel"),
    logIn: t("logIn"),
    checking: t("checking"),
    resend: t("resend"),
    resendIn: t.raw("resendIn") as string,
    resendReady: t("resendReady"),
    waitFor: t.raw("waitFor") as string,
    changeNumber: t("changeNumber"),
    connection: t("errors.connection"),
  };
}
