import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";

/**
 * The header's way into the account (task 21): one static link to /account
 * on every page.
 *
 * - It never reads the session, so every public page stays built ahead of
 *   time. A logged-out visitor who follows it gets the proxy's real 307 to
 *   /login (src/lib/access-routes.ts).
 * - prefetch={false}: a prefetch of /account would meet that redirect.
 * - Ghost, never the blue default: "Book a service" stays the header's one
 *   blue button.
 * - From 1024px (lg) it shows the word "Account". Below, a 44px icon
 *   button; the word stays for screen readers (sr-only), so the link has the
 *   same name at every width. (The word didn't fit the 768px header next to
 *   four page links and "Book a service": test:design checks that row.)
 * - Outside the <nav>: that holds only the site's pages (navigation.ts), and
 *   isn't drawn at all while none is live.
 */
export function AccountLink() {
  const t = useTranslations("Account");
  return (
    <Button asChild variant="ghost" size="sm" className="max-lg:size-11 max-lg:px-0">
      <Link href={ACCOUNT_PATH} prefetch={false}>
        <UserRoundIcon aria-hidden className="size-5 lg:hidden" />
        <span className="sr-only lg:not-sr-only">{t("headerLink")}</span>
      </Link>
    </Button>
  );
}
