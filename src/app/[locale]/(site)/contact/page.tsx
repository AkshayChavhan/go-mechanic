import { PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { OpenStatus } from "@/components/site/open-status";
import { OpeningHoursList } from "@/components/site/opening-hours-list";
import { Section } from "@/components/site/section";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/i18n/format";
import { formatPhoneNumber, telHref, whatsappHref } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";

import { contactRichText } from "../_components/contact-rich-text";
import { pageTones } from "../_components/page-tones";

// /contact (task 19): how to reach the garage, where it is and when it's
// open. Every detail comes from the database (readGarage(), cached), so the
// page is built ahead of time; the open/closed badge is worked out in the
// browser (OpenStatus).
//
// No map and no directions link: the owner hasn't sent the garage's exact
// Google Maps link, and one built from the address lands at Mukai Chowk,
// not the garage (owner, 2026-10-29). The breakdown number is the garage's
// own phone, and the text promises no towing or round-the-clock help.

// A request-time read here would fail `next dev` and `next build` instead of
// quietly making the page slower (as on the home page).
export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }) };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const t = await getTranslations("ContactPage");
  const tContact = await getTranslations("Contact");
  const tHours = await getTranslations("Hours");
  const garage = await readGarage();

  const [introTone, visitTone, breakdownTone] = pageTones(3);
  const phone = formatPhoneNumber(garage.phone);
  const { call } = contactRichText(garage, tContact("whatsappMessage"));

  return (
    <>
      <Section tone={introTone} width="wide">
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="type-headline text-balance">{t("heading")}</h1>
            <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
          </div>
          {/* One blue button (Call), and a plain WhatsApp chat beside it. No
              Book here: the phone bar has one, and a question isn't a booking. */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={telHref(garage.phone)}>
                <PhoneIcon data-icon="inline-start" />
                {tContact("call")} {phone}
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}>
                {tContact("whatsapp")}
              </WhatsAppLink>
            </Button>
          </div>
        </div>
      </Section>

      <Section tone={visitTone} width="wide">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="type-title">{t("findUs")}</h2>
            <p className="type-body">{formatAddress(garage.address, locale)}</p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="type-title">{tHours("title")}</h2>
            <OpenStatus hours={garage.hours} />
            <OpeningHoursList hours={garage.hours} />
          </div>
        </div>
      </Section>

      <Section tone={breakdownTone} width="wide" aria-labelledby="contact-breakdown">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="contact-breakdown" className="type-title">
            {t("breakdownTitle")}
          </h2>
          <p className="type-body text-pretty">{t.rich("breakdown", { phone, call })}</p>
        </div>
      </Section>
    </>
  );
}
