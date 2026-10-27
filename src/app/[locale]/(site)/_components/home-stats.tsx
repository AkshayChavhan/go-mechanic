import { useTranslations } from "next-intl";

import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { StatTile } from "@/components/site/stat-tile";
import type { Shown, TrustStat } from "@/content/home";

import type { Tone } from "./home-tones";

/**
 * The trust stats. The page renders this only when selectTrustStats() gives
 * it something: real numbers in every build, or samples under `npm run dev`.
 * A production build without real numbers has no stats section at all.
 * The tiles reveal together and their numbers count up, with motion allowed.
 */
export function HomeStats({ stats, tone }: { stats: Shown<TrustStat>; tone: Tone }) {
  const t = useTranslations("HomePage.stats");

  return (
    <Section tone={tone} width="wide" aria-labelledby="home-stats">
      <div className="flex flex-col gap-12">
        <h2 id="home-stats" {...sceneMark("reveal")} className="type-headline text-balance">
          {t("title")}
        </h2>
        <dl {...sceneMark("revealGroup")} className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {stats.items.map((stat) => (
            <StatTile key={stat.id} stat={stat} sample={stats.sample} />
          ))}
        </dl>
      </div>
    </Section>
  );
}
