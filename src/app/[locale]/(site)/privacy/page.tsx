import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Section } from "@/components/site/section";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { LOGIN_NOTICE_VERSION } from "@/domain/consent";
import { indiaInstantOn } from "@/domain/india-time";
import { LOGIN_RULES } from "@/domain/login";
import { formatAddress, formatDate } from "@/i18n/format";
import { formatPhoneNumber, telHref, whatsappHref } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";

// /privacy (task 19): the full privacy notice the login's short notice links
// to. A DRAFT under India's DPDP Act, 2023 and its 2025 Rules (their duties
// apply from about May 2027); task 43 finalises it with a lawyer, names the
// person who answers questions and removes the draft line and noindex.
//
// It states only what the code really keeps, and for how long (task 19's
// plan, KTD7). Its wording is part of what a person agrees to at login, so
// consent.test.ts pins every PrivacyPage message under LOGIN_NOTICE_VERSION:
// change the wording and that test fails until the version moves. The
// "last updated" date is that version, so the two never drift apart.
// coverage.test.ts beside this file fails when a new table appears in
// src/server/db/schema.ts that nobody has checked against this notice.

export const ensureStatic = "navigation";

/** The data items, in page order (their text is PrivacyPage.items.<key>). */
const PRIVACY_ITEMS = ["number", "consent", "attempts", "codes", "session", "sms"] as const;

/** The sections after the data items, each with a title and a body (PrivacyPage.<key>). */
const SECTIONS = ["cookies", "rights", "withdraw", "contact", "children", "changes"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PrivacyPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  // noindex until task 43: a draft shouldn't be what a search engine shows.
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }), robots: { index: false } };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations("PrivacyPage");
  const tBrand = await getTranslations("Brand");
  const tContact = await getTranslations("Contact");
  const garage = await readGarage();
  const brand = tBrand("name");

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

  // Numbers come from the rules the code runs on, never typed in here.
  const values = {
    attempts: { hours: LOGIN_RULES.keepRecordsHours },
    codes: { minutes: LOGIN_RULES.codeLifetimeSeconds / 60 },
    session: { days: LOGIN_RULES.sessionDays },
  };

  const sectionTitles: Record<(typeof SECTIONS)[number], string> = {
    cookies: t("cookies.title"),
    rights: t("rights.title"),
    withdraw: t("withdraw.title"),
    contact: t("contact.title"),
    children: t("children.title"),
    changes: t("changes.title"),
  };
  const sectionBodies: Record<(typeof SECTIONS)[number], ReactNode> = {
    cookies: t("cookies.body"),
    rights: t("rights.body"),
    withdraw: t("withdraw.body"),
    contact: t.rich("contact.body", { phone: formatPhoneNumber(garage.phone), call, whatsapp }),
    children: t("children.body"),
    changes: t("changes.body"),
  };
  // Midday India time on the version's date, so the date shown is that date wherever the server runs.
  const updated = formatDate(indiaInstantOn(LOGIN_NOTICE_VERSION, 12 * 60), locale);

  return (
    <Section width="wide">
      <article className="flex max-w-2xl flex-col gap-12">
        <header className="flex flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-callout font-semibold">{t("draft")}</p>
          <p className="type-caption text-muted-foreground">{t("updated", { date: updated })}</p>
          <p className="type-body text-pretty">{t("intro", { brand, address: formatAddress(garage.address, locale) })}</p>
        </header>

        <nav aria-label={t("contents")} className="flex flex-col gap-2">
          <h2 className="type-callout font-semibold">{t("contents")}</h2>
          <ul className="flex flex-col type-callout">
            {[["data", t("data.title")] as const, ...SECTIONS.map((key) => [key, sectionTitles[key]] as const)].map(
              ([key, title]) => (
                <li key={key}>
                  <a href={`#privacy-${key}`} className={`inline-flex pointer-coarse:min-h-11 items-center ${linkClass}`}>
                    {title}
                  </a>
                </li>
              ),
            )}
          </ul>
        </nav>

        <section aria-labelledby="privacy-data" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 id="privacy-data" className="type-title scroll-mt-(--header-height)">
              {t("data.title")}
            </h2>
            <p className="type-body text-pretty">{t("data.lead")}</p>
          </div>
          {PRIVACY_ITEMS.map((item) => (
            <div key={item} className="flex flex-col gap-3">
              <h3 className="type-callout font-semibold">{t(`items.${item}.title`)}</h3>
              {/* Stacked, never a table: four columns don't fit a phone. */}
              <dl className="flex flex-col gap-2">
                {(["what", "why", "who", "howLong"] as const).map((field) => (
                  <div key={field}>
                    <dt className="type-caption text-muted-foreground">{t(`labels.${field}`)}</dt>
                    <dd className="type-body text-pretty">
                      {t(`items.${item}.${field}`, item in values ? values[item as keyof typeof values] : {})}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        {SECTIONS.map((key) => (
          <section key={key} aria-labelledby={`privacy-${key}`} className="flex flex-col gap-3">
            <h2 id={`privacy-${key}`} className="type-title scroll-mt-(--header-height)">
              {sectionTitles[key]}
            </h2>
            <p className="type-body text-pretty">{sectionBodies[key]}</p>
          </section>
        ))}
      </article>
    </Section>
  );
}
