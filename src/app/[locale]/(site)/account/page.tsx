import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountDetails, detailsClass } from "@/components/account/account-details";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { logOut } from "@/server/actions/login";

// /account: who is logged in, and Log out (task 15). Inside the site shell:
// later account pages (task 21's profile and vehicles, task 25's bookings)
// keep the header, footer and phone bar.
//
// Built ahead of time except AccountDetails, which reads the session cookie
// inside <Suspense>. Nothing in the shell reads the session: the home page
// must stay prebuilt (ensureStatic). /account isn't in navigation.ts and the
// header has no login link yet (task 21 adds one).

// Static: reads no session. noindex: a personal page, nothing to list.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  const tBrand = await getTranslations("Brand");
  return {
    title: t("metaTitle", { brand: tBrand("name") }),
    robots: { index: false, follow: false },
  };
}

export default function AccountPage() {
  const t = useTranslations("Account");
  const locale = useLocale();

  return (
    // wide: the left edge lines up with the header's Wordmark.
    <Section width="wide">
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          {/* The loading line has the details' classes and one line of text,
              so nothing below moves when the details stream in. */}
          <Suspense fallback={<p className={detailsClass}>{t("loading")}</p>}>
            <AccountDetails locale={locale} />
          </Suspense>
        </div>
        {/* Outside <Suspense> on purpose: content that streams in needs
            JavaScript to appear, and Log out must work without it. A plain
            form posting to the logOut Server Action does. */}
        <form action={logOut.bind(null, locale)}>
          <Button type="submit" variant="secondary">
            {t("logOut")}
          </Button>
        </form>
      </div>
    </Section>
  );
}
