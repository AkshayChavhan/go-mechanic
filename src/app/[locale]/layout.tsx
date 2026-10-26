import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { fontVariables } from "@/app/fonts";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import "@/app/globals.css";

// This is the root layout: it sits inside [locale], so `locale` is a "root
// param" every server component can read. With Cache Components, every root
// param needs at least one value known at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The <meta name="viewport"> tag. Next.js already sends width=device-width
// and initial-scale=1; this adds viewport-fit=cover, which lets the page
// reach under an iPhone's rounded corners and home indicator. globals.css
// then keeps text and buttons clear of them with env(safe-area-inset-*)
// (--gutter, --action-bar-padding-bottom).
export const viewport: Viewport = {
  viewportFit: "cover",
};

// Placeholder metadata. Task 42 adds full SEO metadata.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  // Unknown locales never get here: src/i18n/request.ts calls notFound().
  const locale = await getLocale();
  return (
    <html lang={locale} className={cn(fontVariables, "font-sans antialiased")}>
      <body>
        {/* Gives client components the language, text and time zone. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
