import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { fontVariables } from "@/app/fonts";
import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteChrome } from "@/components/site/site-chrome";
import { pickClientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { readGarage } from "@/server/dal/garage";

import "@/app/globals.css";

// The 404 page for any URL that matches no route at all. Because the root
// layout lives inside [locale], Next.js needs this separate page
// (experimental.globalNotFound in next.config.ts). It skips every layout, so
// it brings its own <html>, fonts, styles and viewport, and wraps itself in
// the same shell as the public pages.
//
// It sits outside [locale], so the URL has no language in it. Code here
// passes the default one explicitly; the shell's components, which don't,
// get the same default from src/i18n/request.ts.
const locale = routing.defaultLocale;

// The same viewport as the root layout: viewport-fit=cover for iPhones.
export const viewport: Viewport = {
  viewportFit: "cover",
};

// "Page not found | <brand>". The brand comes from Brand.name, so a rename
// still touches only messages/en.json. 404 pages get noindex automatically.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "NotFound" });
  const tBrand = await getTranslations({ locale, namespace: "Brand" });
  return { title: t("metaTitle", { brand: tBrand("name") }) };
}

export default async function GlobalNotFound() {
  const messages = await getMessages({ locale });
  const garage = await readGarage();
  return (
    <html lang={locale} className={cn(fontVariables, "font-sans antialiased")}>
      <body>
        {/* Required here, not optional: the shell's links (Link from
            @/i18n/navigation) read the language from this provider. Like the
            root layout, it sends only the client components' messages. */}
        <NextIntlClientProvider locale={locale} messages={pickClientMessages(messages)}>
          <SiteChrome garage={garage}>
            <NotFoundContent garage={garage} />
          </SiteChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
