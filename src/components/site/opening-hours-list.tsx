import { useLocale, useTranslations } from "next-intl";

import { groupWeeklyHours, type DayHours, type Weekday, type WeeklyHours } from "@/domain/opening-hours";
import { formatTimeOfDay, formatWeekday } from "@/i18n/format";

/**
 * The garage's week, with days that share their hours joined:
 * "Monday / Closed", "Tuesday to Sunday / 10:00 am to 7:00 pm", then a note
 * that the times are India time. Plain server-rendered text, so the hours are
 * readable before (or without) JavaScript, unlike the live OpenStatus badge.
 *
 * Used in the phone menu and the footer. Weekday names come from Intl, so
 * Hindi gets them without new messages.
 */
export function OpeningHoursList({ hours }: { hours: WeeklyHours }) {
  const t = useTranslations("Hours");
  const locale = useLocale();

  const days = (from: Weekday, to: Weekday) =>
    from === to
      ? formatWeekday(from, locale)
      : t("dayRange", { from: formatWeekday(from, locale), to: formatWeekday(to, locale) });

  const times = (day: DayHours) =>
    day === "closed"
      ? t("closed")
      : t("times", { opens: formatTimeOfDay(day.opens, locale), closes: formatTimeOfDay(day.closes, locale) });

  return (
    <div className="flex flex-col gap-3">
      {/* A description list: each day (dt) with its hours (dd). */}
      <dl className="flex flex-col gap-2">
        {groupWeeklyHours(hours).map((group) => (
          <div key={group.from} className="flex flex-col">
            <dt className="type-callout font-medium">{days(group.from, group.to)}</dt>
            <dd className="type-callout text-muted-foreground">{times(group.hours)}</dd>
          </div>
        ))}
      </dl>
      <p className="type-caption text-muted-foreground">{t("indiaTime")}</p>
    </div>
  );
}
