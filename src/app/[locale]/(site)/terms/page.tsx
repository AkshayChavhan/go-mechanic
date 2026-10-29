import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Section } from "@/components/site/section";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { indiaInstantOn } from "@/domain/india-time";
import { formatAddress, formatDate } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref, whatsappHref } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";

// /terms (task 19): a DRAFT of the terms for using the website and visiting
// the garage. It states only what's decided (booking is a request for a
// time, work and price are agreed first, payment at the garage in cash or
// UPI) and lists what isn't (cancellations, warranty, responsibility for
// vehicles), instead of inventing it. Task 43 finalises it with a lawyer and
// removes the draft line and noindex.

export const ensureStatic = "navigation";

const SECTIONS = ["booking", "work", "paying", "login", "undecided", "questions"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TermsPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  // noindex until task 43: a draft shouldn't be what a search engine shows.
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }), robots: { index: false } };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations("TermsPage");
  const tBrand = await getTranslations("Brand");
  const tContact = await getTranslations("Contact");
  const garage = await readGarage();

  const linkClass = "text-link underline underline-offset-4";
  const call = (chunks: ReactNode) => (
    <a href={telHref(garage.phone)} className={`whitespace-nowrap ${linkClass}`}>
      {chunks}
    </a>
  );
  const whatsapp = (chunks: ReactNode) => (
    <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))} className={`${linkClass} [&_svg]:hidden`}>
      {chunks}
    </WhatsAppLink>
  );
  const privacy = (chunks: ReactNode) => (
    <Link href="/privacy" className={linkClass}>
      {chunks}
    </Link>
  );

  const titles: Record<(typeof SECTIONS)[number], string> = {
    booking: t("booking.title"),
    work: t("work.title"),
    paying: t("paying.title"),
    login: t("login.title"),
    undecided: t("undecided.title"),
    questions: t("questions.title"),
  };
  const bodies: Record<(typeof SECTIONS)[number], ReactNode> = {
    booking: t("booking.body"),
    work: t("work.body"),
    paying: t("paying.body"),
    login: t.rich("login.body", { privacy }),
    undecided: t("undecided.body"),
    questions: t.rich("questions.body", { phone: formatPhoneNumber(garage.phone), call, whatsapp }),
  };
  // Midday India time on the date in messages, so it shows that date wherever the server runs.
  const updated = formatDate(indiaInstantOn(t("updatedOn"), 12 * 60), locale);

  return (
    <Section width="wide">
      <article className="flex max-w-2xl flex-col gap-12">
        <header className="flex flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-callout font-semibold">{t("draft")}</p>
          <p className="type-caption text-muted-foreground">{t("updated", { date: updated })}</p>
          <p className="type-body text-pretty">
            {t("intro", { brand: tBrand("name"), address: formatAddress(garage.address, locale) })}
          </p>
        </header>

        {SECTIONS.map((key) => (
          <section key={key} aria-labelledby={`terms-${key}`} className="flex flex-col gap-3">
            <h2 id={`terms-${key}`} className="type-title">
              {titles[key]}
            </h2>
            <p className="type-body text-pretty">{bodies[key]}</p>
          </section>
        ))}
      </article>
    </Section>
  );
}
