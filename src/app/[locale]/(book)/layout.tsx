import { SiteChrome } from "@/components/site/site-chrome";
import { readGarage } from "@/server/dal/garage";

// (book) is a route group, like (site): the brackets keep "book" out of the
// URL, so (book)/book/page.tsx will be "/book". Its pages get the same shell
// as (site) (header, offer banner, footer) but not the phone action bar or
// its spacer: on /book the page's own buttons sit at the bottom of a phone,
// where the bar would be. A group of its own rather than a check of the URL,
// so the shell reads nothing from the request and the pages stay prerendered.
//
// Async because it reads the garage's details from the database. readGarage()
// is cached, so the pages below still get built ahead of time.
export default async function BookLayout({ children }: LayoutProps<"/[locale]">) {
  const garage = await readGarage();
  return (
    <SiteChrome garage={garage} actionBar={false}>
      {children}
    </SiteChrome>
  );
}
