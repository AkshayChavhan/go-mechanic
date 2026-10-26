import { SiteChrome } from "@/components/site/site-chrome";

// (site) is a route group: the brackets keep "site" out of the URL, so
// (site)/page.tsx is still "/". Every page in this folder (the home page now;
// services, prices, about, contact and booking later) gets the shell: header,
// footer and the phone bar. Pages outside it, such as /dev/design (and later
// /admin and /login), don't.
export default function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  return <SiteChrome>{children}</SiteChrome>;
}
