import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { TrustStat } from "@/content/home";
import { formatNumber } from "@/i18n/format";

import { SampleBadge } from "./sample-badge";
import { sceneCount } from "./scroll-scene-attributes";

/**
 * One trust stat: a big number and its label, as a pair inside a <dl>.
 *
 * The number is drawn twice, in the same grid cell (plan KTD6):
 * - the first copy is the one screen readers read. It's invisible
 *   (opacity 0) but still takes up room, so it fixes the cell's width: the
 *   counting copy can never push the text around it;
 * - the second copy is the one people see. It's hidden from screen readers
 *   (aria-hidden), so nothing is announced while ScrollScene's effects count
 *   its digits up. Only the digits are marked (sceneCount); the words around
 *   them ("+", "/5", " months") come from messages and never change.
 * Without JavaScript, or with reduced motion, both copies simply show the
 * final value. There's no aria-live anywhere.
 *
 * `sample` marks a made-up stat (`npm run dev` only): a "Sample" badge, and
 * data-sample for the tests.
 */
export function StatTile({ stat, sample = false }: { stat: TrustStat; sample?: boolean }) {
  const t = useTranslations("HomePage.stats");
  const locale = useLocale();
  const digits = formatNumber(stat.value, locale, stat.decimals);

  /** The value's message ("<number>{value}</number>+"), with the digits wrapped as `number` says. */
  const value = (number: (chunks: ReactNode) => ReactNode) => t.rich(`${stat.id}.value`, { value: digits, number });

  return (
    <div {...(sample ? { "data-sample": "" } : {})} className="flex flex-col gap-2 rounded-xl bg-card p-5 md:p-6">
      <dt className="flex flex-wrap items-center gap-2 type-callout text-muted-foreground">
        {t(`${stat.id}.label`)}
        {sample && <SampleBadge />}
      </dt>
      {/* order-first: the number shows above its label; screen readers still
          hear the label first. tabular-nums: every digit is as wide as the
          others, so a count doesn't wobble. */}
      <dd className="order-first grid type-headline tabular-nums">
        <span className="col-start-1 row-start-1 opacity-0">{value((chunks) => chunks)}</span>
        <span aria-hidden="true" className="col-start-1 row-start-1">
          {value((chunks) => (
            <span {...(stat.counts ? sceneCount(stat.value, stat.decimals) : {})}>{chunks}</span>
          ))}
        </span>
      </dd>
    </div>
  );
}
