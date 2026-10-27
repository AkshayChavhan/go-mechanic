"use client";

// The live "Open now / Closed" badge, in India time.
//
// It works out the status in the browser, not on the server (plan KTD1). The
// shell wraps every page; reading the clock on the server would make every
// page render on each visit instead of being built once. So the prebuilt HTML
// holds an empty slot of the same height, and the browser fills it in as soon
// as React starts, then checks again every minute.
//
// A client component: it reads the visitor's clock and listens for events.
// Its text comes from the OpenStatus messages, the only namespace it uses.

import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { openStatusAt, type OpenStatus as Status, type WeeklyHours } from "@/domain/opening-hours";
import { formatTime, formatWeekday, keepTogether } from "@/i18n/format";

const MINUTE = 60_000; // milliseconds

// Every state, the empty one included, is one row with the same minimum
// height, so nothing below it moves when the status appears (no layout shift).
const rowClass = "flex min-h-6 items-center gap-2";

/**
 * The badge and its line of text for one status: "Open now · until 7:00 pm",
 * "Closed · Opens tomorrow at 10:00 am". OpenStatus below feeds it the live
 * status; /dev/design can show each state with a made-up one.
 */
export function OpenStatusView({ status }: { status: Status }) {
  const t = useTranslations("OpenStatus");
  const locale = useLocale();

  // Times and weekdays are formatted first (India time, en-IN), then passed
  // to t() as plain text: next-intl's own date formatting would use plain "en".
  // keepTogether: the line may wrap before "10:00 am", never inside it.
  let detail: string | null = null;
  if (status.isOpen) {
    detail = t("until", { time: keepTogether(formatTime(status.closesAt, locale)) });
  } else if (status.nextOpening) {
    const { at, when, weekday } = status.nextOpening;
    const time = keepTogether(formatTime(at, locale));
    if (when === "today") detail = t("opensToday", { time });
    else if (when === "tomorrow") detail = t("opensTomorrow", { time });
    else detail = t("opensOn", { day: formatWeekday(weekday, locale, "short"), time });
  }

  return (
    <div data-open-status={status.isOpen ? "open" : "closed"} className={rowClass}>
      {/* Green for open; grey for closed, because closed is normal, not a problem. */}
      <Badge variant={status.isOpen ? "success" : "secondary"}>{status.isOpen ? t("open") : t("closed")}</Badge>
      {detail && <span className="type-callout text-muted-foreground">{detail}</span>}
    </div>
  );
}

/**
 * The live status: whether the garage is open now, by the visitor's clock,
 * read in India time. It updates by itself while the page stays open.
 */
export function OpenStatus({ hours }: { hours: WeeklyHours }) {
  const minute = useCurrentMinute();
  if (minute === null) {
    // The prebuilt HTML, and the first render while React takes it over.
    return <div data-open-status="pending" className={rowClass} />;
  }
  return <OpenStatusView status={openStatusAt(hours, new Date(minute * MINUTE))} />;
}

// --- The clock -------------------------------------------------------------
//
// useSyncExternalStore is React's way to read a value that lives outside
// React (here, the clock). It takes three functions:
// - subscribe: tells React when the value may have changed;
// - getSnapshot: reads the value in the browser;
// - getServerSnapshot: the value on the server, and while React takes over
//   the server's HTML (hydration). It's null here, so the server's HTML and
//   the browser's first render always match, whatever the time.

/**
 * The current minute, counted from 1 January 1970. It changes once a minute,
 * so React re-renders once a minute, not on every check.
 */
function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE);
}

/** No clock on the server: see above. */
function noMinuteOnServer(): null {
  return null;
}

/**
 * Asks React to read the clock again just after each minute starts, when the
 * visitor comes back to the tab (browsers slow down or pause timers in hidden
 * tabs), and when the page comes back from the back/forward cache.
 */
function subscribeToMinutes(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleNextMinute = () => {
    clearTimeout(timer);
    // At 18:59:30, wait 30 seconds.
    timer = setTimeout(checkNow, MINUTE - (Date.now() % MINUTE));
  };
  const checkNow = () => {
    onChange();
    scheduleNextMinute();
  };

  scheduleNextMinute();
  document.addEventListener("visibilitychange", checkNow);
  window.addEventListener("pageshow", checkNow);
  // React calls this when the component leaves the page.
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", checkNow);
    window.removeEventListener("pageshow", checkNow);
  };
}

function useCurrentMinute(): number | null {
  return useSyncExternalStore(subscribeToMinutes, currentMinute, noMinuteOnServer);
}
