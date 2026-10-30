import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { bookTarget } from "@/components/site/navigation";
import { OpenStatus } from "@/components/site/open-status";
import { OpeningHoursList } from "@/components/site/opening-hours-list";
import { SampleBadge } from "@/components/site/sample-badge";
import { Section } from "@/components/site/section";
import { selectAboutTopics } from "@/content/about";
import { localize } from "@/i18n/localized-text";
import { whatsappHref } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";

import { HomeActions } from "../_components/home-actions";
import { pageTones } from "../_components/page-tones";

// /about (task 19): what the garage is, when it's open and how to book.
//
// Every build shows only confirmed facts: where the garage is, that it works
// on cars and two-wheelers (messages, AboutPage), and its hours (database).
// The story, team, certificates, parts and warranty aren't known yet: under
// `npm run dev` they show as labelled samples (src/content/about.ts); in
// production their section isn't there at all (owner, 2026-10-29).

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AboutPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }) };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations("AboutPage");
  const tContact = await getTranslations("Contact");
  const tHours = await getTranslations("Hours");
  const garage = await readGarage();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));

  // Real topics, else samples under `npm run dev`, else null.
  const topics = selectAboutTopics();
  const tones = pageTones(topics ? 3 : 2);
  const [introTone, topicsTone] = tones;
  const visitTone = tones[tones.length - 1];

  return (
    <>
      <Section tone={introTone} width="wide">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>
      </Section>

      {topics && (
        <Section tone={topicsTone} width="wide">
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {topics.items.map((topic) => (
              <article
                key={topic.id}
                className="flex flex-col gap-2"
                {...(topics.sample ? { "data-sample": "" } : {})}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="type-title">{localize(topic.title, locale)}</h2>
                  {topics.sample && <SampleBadge />}
                </div>
                <p className="type-body text-pretty text-muted-foreground">{localize(topic.body, locale)}</p>
              </article>
            ))}
          </div>
        </Section>
      )}

      <Section tone={visitTone} width="wide">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="type-title">{t("visitTitle")}</h2>
              <p className="type-body text-pretty">{t("visit")}</p>
            </div>
            {/* Never inside a reveal target: there's no scroll motion on this page. */}
            <HomeActions book={book} phone={garage.phone} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="type-title">{tHours("title")}</h2>
            <OpenStatus hours={garage.hours} />
            <OpeningHoursList hours={garage.hours} />
          </div>
        </div>
      </Section>
    </>
  );
}
