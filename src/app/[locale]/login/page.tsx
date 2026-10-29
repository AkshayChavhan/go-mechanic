import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { LoginForm } from "@/components/account/login-form";
import { Section } from "@/components/site/section";
import { Wordmark } from "@/components/site/wordmark";
import { Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref } from "@/lib/contact-links";
import { loginStep } from "@/server/actions/login";
import { readGarage } from "@/server/dal/garage";

import { RedirectIfSignedIn } from "./redirect-if-signed-in";

// /login: log in with a mobile number and an SMS code (task 15).
//
// Outside the (site) folder, so no shell: a slim bar with the Wordmark, as on
// the 404, keeps the visitor on the one job. Everything here is built ahead
// of time except <RedirectIfSignedIn>, which waits for the request inside
// <Suspense> because it reads the session cookie.

// Static: reads no session, so it never makes the page wait for a request.
// noindex: a login form is nothing a search engine should list.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Login");
  const tBrand = await getTranslations("Brand");
  return {
    title: t("metaTitle", { brand: tBrand("name") }),
    robots: { index: false, follow: false },
  };
}

// Async because it reads the garage (its phone number) from the database.
// readGarage() is cached, so the page is still built ahead of time.
export default async function LoginPage() {
  const locale = await getLocale();
  const t = await getTranslations("Login");
  const tBrand = await getTranslations("Brand");
  const garage = await readGarage();

  // "Call us on +91 97647 50567": the number is a link that dials it.
  const phone = formatPhoneNumber(garage.phone);
  const call = (chunks: ReactNode) => (
    <a href={telHref(garage.phone)} className="whitespace-nowrap text-link underline underline-offset-4">
      {chunks}
    </a>
  );
  // The full privacy notice opens in a new tab, so a half-filled form here
  // isn't lost (the number and both boxes live only in this page).
  const privacy = (chunks: ReactNode) => (
    <Link href="/privacy" target="_blank" rel="noopener" className="text-link underline underline-offset-4">
      {chunks}
      <span className="sr-only"> {t("opensInNewTab")}</span>
    </Link>
  );

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto box-content flex h-(--header-height) max-w-wide items-center px-(--gutter)">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Wordmark className="type-lead" />
          </Link>
        </div>
      </header>
      <main id="main">
        {/* wide: the column's left edge lines up with the Wordmark, as on the 404. */}
        <Section width="wide">
          <div className="flex max-w-md flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h1 className="type-headline text-balance">{t("heading")}</h1>
              <p className="type-lead text-pretty text-muted-foreground">{t("intro")}</p>
            </div>
            {/* The form needs JavaScript. Without it, say so and offer the phone. */}
            <noscript>
              <p className="type-body">{t.rich("noScript", { phone, call })}</p>
            </noscript>
            <LoginForm
              // The locale goes in as the action's first argument: a Server
              // Action has no [locale] page around it to read it from.
              action={loginStep.bind(null, locale)}
              labels={{
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
                // Raw templates: the browser fills in {time} as it counts down.
                resendIn: t.raw("resendIn") as string,
                resendReady: t("resendReady"),
                waitFor: t.raw("waitFor") as string,
                changeNumber: t("changeNumber"),
                connection: t("errors.connection"),
              }}
            />
            <p className="border-t border-border pt-6 type-callout text-muted-foreground">
              {t.rich("help", { phone, call })}
            </p>
          </div>
        </Section>
        <Suspense fallback={null}>
          <RedirectIfSignedIn locale={locale} />
        </Suspense>
      </main>
    </>
  );
}
