import { useTranslations } from "next-intl";

import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { VisualSlot } from "@/components/site/visual-slot";

// How a visit works today (plan A2). Nothing the garage or the site doesn't
// offer yet: no pickup, online tracking, online estimates or online payment.
const STEPS = ["book", "visit", "check", "collect"] as const;

/**
 * "How a visit works", on the black showcase band.
 *
 * On large screens (the story: query, plan KTD4) it has two columns: the
 * picture sits in a sticky column (CSS position: sticky, below the header and
 * at most --stage-height tall), so it stays in view while the four steps
 * scroll past beside it. With motion allowed, ScrollScene's effects grow the
 * picture to its natural size and fill each step's rail as it passes. The
 * layout is the same without JavaScript; only the movement is missing.
 * Elsewhere the picture and the steps stack.
 *
 * The rail under each number is a hairline track; its fill (scale-y-0) only
 * shows when the effects scale it. Text is never dimmed.
 */
export function HomeStory() {
  const t = useTranslations("HomePage.story");

  return (
    <Section tone="dark" width="wide" aria-labelledby="home-story" {...sceneMark("story")}>
      <div className="flex flex-col gap-12">
        <div {...sceneMark("reveal")} className="flex max-w-2xl flex-col gap-4">
          <h2 id="home-story" className="type-headline text-balance">
            {t("title")}
          </h2>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>

        <div className="grid gap-12 story:grid-cols-2 story:gap-16">
          <div className="story:sticky story:top-(--header-height) story:flex story:h-(--stage-height) story:items-center">
            {/* The scaled element is the slot itself: no scale-* or translate-*
                classes on it, because GSAP sets its transform. */}
            <VisualSlot
              photo={null}
              sizes="(min-width: 64rem) 50vw, 100vw"
              className="w-full"
              {...sceneMark("storyVisual")}
            />
          </div>

          {/* An ordered list: screen readers announce "1 of 4", so the drawn
              numbers are hidden from them. */}
          <ol className="flex flex-col story:py-[calc(var(--stage-height)/4)]">
            {STEPS.map((step, index) => (
              <li
                key={step}
                {...sceneMark("storyStep")}
                className="grid grid-cols-[auto_1fr] gap-x-5 story:min-h-[calc(var(--stage-height)/2)]"
              >
                <div aria-hidden="true" className="flex flex-col items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border type-callout font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span className="relative my-3 w-px grow bg-border">
                    <span {...sceneMark("storyRail")} className="absolute inset-0 origin-top scale-y-0 bg-foreground" />
                  </span>
                </div>
                <div {...sceneMark("reveal")} className="flex flex-col gap-2 pb-12">
                  <h3 className="type-title text-balance">{t(`steps.${step}.title`)}</h3>
                  <p className="text-pretty text-muted-foreground">{t(`steps.${step}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
