import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NotFoundContent } from "@/components/site/not-found-content";
import { Wordmark } from "@/components/site/wordmark";
import { Link } from "@/i18n/navigation";
import { readGarage } from "@/server/dal/garage";

// The 404 for a page that exists but has nothing to show: it called
// notFound() (/dev/design in production, later an unknown service).
//
// A slim bar with the Wordmark, not the full shell: Next.js sends this
// file's content along with every page under [locale], just in case it's
// needed, so the full header and footer here would ride along on every page.
// URLs that match no page at all get src/app/global-not-found.tsx instead,
// with the full shell.

// "Page not found | <brand>". Next.js uses it only when notFound() is called
// while a page's metadata is worked out (generateMetadata), so a page that
// can 404 calls notFound() there too, as /dev/design does.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  const tBrand = await getTranslations("Brand");
  return { title: t("metaTitle", { brand: tBrand("name") }) };
}

// Async because it reads the garage (for its Call and WhatsApp links) from
// the database. readGarage() is cached, so this costs no query per page.
export default async function NotFound() {
  const garage = await readGarage();
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
        <NotFoundContent garage={garage} />
      </main>
    </>
  );
}
