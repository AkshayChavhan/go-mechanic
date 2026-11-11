import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { OpeningHoursList } from "@/components/site/opening-hours-list";
import { SampleBadge } from "@/components/site/sample-badge";
import { Section } from "@/components/site/section";
import { FAQ_GROUPS, type FaqGroup, selectFaqItems } from "@/content/faq";
import { localize } from "@/i18n/localized-text";
import { readGarage } from "@/server/dal/garage";

import { contactRichText } from "../_components/contact-rich-text";
import { pageTones } from "../_components/page-tones";

// /faq (task 19): common questions, as plain headings and paragraphs (no
// accordion), so every answer is in the page built ahead of time.
//
// Confirmed answers (owner, 2026-10-29: cash or UPI at the garage; booking by
// WhatsApp or call; the hours from the database) show in every build. Answers
// nobody has confirmed yet show under `npm run dev` as labelled samples
// (src/content/faq.ts); a group with nothing confirmed isn't there in
// production. Task 42 adds the FAQPage structured data.

export const ensureStatic = "navigation";

/** The confirmed questions in each group, in order (their text is FaqPage.items.<key>). */
const confirmed = {
  paying: ["howToPay", "payOnline", "howToBook"],
  visit: ["hours"],
  work: [],
} as const satisfies Record<FaqGroup, readonly string[]>;

/** A confirmed question's key: every one needs a question and an answer below. */
type ConfirmedKey = (typeof confirmed)[FaqGroup][number];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FaqPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }) };
}

export default async function FaqPage() {
  const locale = await getLocale();
  const t = await getTranslations("FaqPage");
  const tContact = await getTranslations("Contact");
  const garage = await readGarage();

  // Answers from src/content/faq.ts: real ones once the owner gives them,
  // else samples under `npm run dev` (marked Sample), else none.
  const extra = selectFaqItems();
  const groups = FAQ_GROUPS.map((group) => ({
    group,
    keys: confirmed[group],
    items: extra ? extra.items.filter((item) => item.group === group) : [],
  })).filter(({ keys, items }) => keys.length + items.length > 0);
  const tones = pageTones(1 + groups.length);
  const groupTitles: Record<FaqGroup, string> = {
    paying: t("groups.paying"),
    visit: t("groups.visit"),
    work: t("groups.work"),
  };

  const answers: Record<ConfirmedKey, ReactNode> = {
    howToPay: t("items.howToPay.answer"),
    payOnline: t("items.payOnline.answer"),
    howToBook: t.rich("items.howToBook.answer", contactRichText(garage, tContact("whatsappMessage"))),
    hours: <OpeningHoursList hours={garage.hours} />,
  };
  const questions: Record<ConfirmedKey, string> = {
    howToPay: t("items.howToPay.question"),
    payOnline: t("items.payOnline.question"),
    howToBook: t("items.howToBook.question"),
    hours: t("items.hours.question"),
  };

  return (
    <>
      <Section tone={tones[0]} width="wide">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>
      </Section>

      {groups.map(({ group, keys, items }, index) => (
        <Section key={group} tone={tones[index + 1]} width="wide" aria-labelledby={`faq-${group}`}>
          <div className="flex max-w-2xl flex-col gap-8">
            <h2 id={`faq-${group}`} className="type-headline text-balance">
              {groupTitles[group]}
            </h2>
            <div className="flex flex-col gap-8">
              {keys.map((key) => (
                <div key={key} className="flex flex-col gap-2">
                  <h3 className="type-title">{questions[key]}</h3>
                  <div className="type-body text-pretty">{answers[key]}</div>
                </div>
              ))}
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-2" {...(extra?.sample ? { "data-sample": "" } : {})}>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="type-title">{localize(item.question, locale)}</h3>
                    {extra?.sample && <SampleBadge />}
                  </div>
                  <p className="type-body text-pretty">{localize(item.answer, locale)}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ))}
    </>
  );
}
