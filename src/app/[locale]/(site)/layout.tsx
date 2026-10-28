import { SiteChrome } from "@/components/site/site-chrome";
import { readGarage } from "@/server/dal/garage";

// (site) is a route group: the brackets keep "site" out of the URL, so
// (site)/page.tsx is still "/". Every page in this folder (the home page now;
// services, prices, about, contact and booking later) gets the shell: header,
// footer and the phone bar. Pages outside it, such as /dev/design (and later
// /admin and /login), don't.
//
// Async because it reads the garage's details from the database. readGarage()
// is cached, so the pages below still get built ahead of time.
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const garage = await readGarage();
  return <SiteChrome garage={garage}>{children}</SiteChrome>;
}
