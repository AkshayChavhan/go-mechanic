import { PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Garage } from "@/content/garage";
import { Link } from "@/i18n/navigation";
import { telHref, whatsappHref } from "@/lib/contact-links";

import { Section } from "./section";
import { WhatsAppLink } from "./whatsapp-link";

/**
 * What both 404 pages show: a heading, a short explanation, a way home and,
 * because a lost visitor may just want the garage, Call and WhatsApp.
 *
 * Used by src/app/global-not-found.tsx (a URL that matches no page) inside
 * the full shell, and by src/app/[locale]/not-found.tsx (a page that called
 * notFound()) under a slim bar.
 */
type NotFoundContentProps = {
  /** The garage's numbers, for Call and WhatsApp. */
  garage: Pick<Garage, "phone" | "whatsapp">;
  /** The heading's level: h1 on the 404 pages, h2 in the /dev/design sample (a page has one h1). */
  titleAs?: "h1" | "h2";
};

export function NotFoundContent({ garage, titleAs: Title = "h1" }: NotFoundContentProps) {
  const t = useTranslations("NotFound");
  const tContact = useTranslations("Contact");

  return (
    // wide: its left edge lines up with the header's Wordmark and the footer.
    <Section width="wide">
      <div className="flex max-w-2xl flex-col gap-6">
        <Title className="type-display text-balance">{t("title")}</Title>
        <p className="type-lead text-muted-foreground">{t("description")}</p>
        <div className="flex flex-wrap gap-3">
          {/* The one blue button: home. */}
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <a href={telHref(garage.phone)}>
              <PhoneIcon data-icon="inline-start" />
              {tContact("call")}
            </a>
          </Button>
          <Button asChild variant="secondary">
            <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}>
              {tContact("whatsapp")}
            </WhatsAppLink>
          </Button>
        </div>
      </div>
    </Section>
  );
}
