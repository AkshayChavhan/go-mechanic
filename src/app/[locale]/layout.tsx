import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { sansFont } from "@/app/fonts";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import "@/app/globals.css";

// This is the root layout: it sits inside [locale], so `locale` is a "root
// param" every server component can read. With Cache Components, every root
// param needs at least one value known at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Placeholder metadata. Task 42 adds full SEO metadata.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  // Unknown locales never get here: src/i18n/request.ts calls notFound().
  const locale = await getLocale();
  return (
    <html lang={locale} className={cn("font-sans", sansFont.variable)}>
      <body>
        {/* Gives client components the language, text and time zone. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
