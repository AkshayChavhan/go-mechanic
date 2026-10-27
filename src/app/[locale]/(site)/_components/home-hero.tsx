import { useTranslations } from "next-intl";

import type { BookTarget } from "@/components/site/navigation";
import { Section } from "@/components/site/section";
import { VisualSlot } from "@/components/site/visual-slot";

import { HomeActions } from "./home-actions";

/**
 * The first screen: what the garage does and where (the page's only h1),
 * Book and Call, and the picture slot. On large screens (the story: query)
 * the words and the picture sit side by side and fill the screen below the
 * header; elsewhere the picture follows the words, so on a phone the heading
 * and both buttons fit above the action bar.
 *
 * Nothing here is a reveal target: it's on screen when the page opens, and
 * nothing on screen ever moves on load.
 */
export function HomeHero({ book, phone }: { book: BookTarget; phone: string }) {
  const t = useTranslations("HomePage");

  return (
    <Section
      width="wide"
      aria-labelledby="home-title"
      className="story:flex story:min-h-(--stage-height) story:flex-col story:justify-center"
    >
      <div className="grid items-center gap-10 story:grid-cols-2 story:gap-16">
        <div className="flex flex-col gap-6">
          <h1 id="home-title" className="type-hero text-balance">
            {t("title")}
          </h1>
          <p className="max-w-xl type-lead text-pretty text-muted-foreground">{t("hero.lead")}</p>
          <HomeActions book={book} phone={phone} />
        </div>
        {/* No photo yet: the line drawing. A photo here loads eagerly (the
            page's largest image); its alt text joins messages with it. */}
        <VisualSlot photo={null} sizes="(min-width: 64rem) 50vw, 100vw" eager />
      </div>
    </Section>
  );
}
