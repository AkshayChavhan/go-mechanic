import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { sansFont } from "./fonts";
import "./globals.css";

// The 404 page for any URL that matches no route. Because the root layout lives
// inside [locale], Next.js needs this separate page (experimental.globalNotFound
// in next.config.ts). It sits outside [locale], so it can't read the locale from
// the URL and passes the default one explicitly. Task 12 designs the real 404.
const locale = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return { title: t("title") };
}

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return (
    <html lang={locale} className={cn("font-sans", sansFont.variable)}>
      <body>
        <main>
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
          {/* next/link, not @/i18n/navigation: that one needs the [locale] tree.
              "/" is the English home page. */}
          <Link href="/">{t("backHome")}</Link>
        </main>
      </body>
    </html>
  );
}
