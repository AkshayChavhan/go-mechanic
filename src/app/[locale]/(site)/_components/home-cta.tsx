import { useTranslations } from "next-intl";

import type { BookTarget } from "@/components/site/navigation";
import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";

import { HomeActions } from "./home-actions";
import type { Tone } from "./home-tones";

/**
 * The last section before the footer: one line on how to book, then Book and
 * Call again. No hours or open status: the footer right below shows them.
 * The heading and line reveal; the buttons sit outside the reveal target.
 */
export function HomeCta({ book, phone, tone }: { book: BookTarget; phone: string; tone: Tone }) {
  const t = useTranslations("HomePage.cta");

  return (
    <Section tone={tone} width="wide" aria-labelledby="home-cta">
      <div className="flex max-w-2xl flex-col gap-8">
        <div {...sceneMark("reveal")} className="flex flex-col gap-4">
          <h2 id="home-cta" className="type-display text-balance">
            {t("title")}
          </h2>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>
        <HomeActions book={book} phone={phone} />
      </div>
    </Section>
  );
}
