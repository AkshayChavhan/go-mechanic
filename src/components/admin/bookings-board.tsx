import { ChevronLeftIcon, ChevronRightIcon, PhoneIcon, TruckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type BoardNotice as Notice, type BoardView, boardQuery, boardRange, isOnBoard, SHOW_CANCELLED } from "@/domain/board-dates";
import { type BookingStatus, formatBookingCode } from "@/domain/bookings";
import { addDays, type IndiaDate } from "@/domain/india-time";
import { formatRegistration } from "@/domain/registration";
import type { Locale } from "@/i18n/config";
import { formatIndiaLongDay, formatTime } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { getPathname, Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref } from "@/lib/contact-links";
import type { StaffBookingRow } from "@/server/dal/staff-bookings";
import type { Mechanic } from "@/server/dal/staff-users";

import { BoardNotice } from "./board-notice";
import { BookingManagePanel } from "./booking-manage-panel";

export type BookingsBoardProps = {
  locale: Locale;
  /** The day shown, already checked by pickBoardDate. */
  date: IndiaDate;
  /** Today in India, read at request time. */
  today: IndiaDate;
  /** True when the asked-for date couldn't be used, so `date` is today. */
  note: boolean;
  /** That day's bookings, earliest first (listBookingsOn), cancelled ones included. */
  bookings: StaffBookingRow[];
  /** `?cancelled=show`: list the cancelled bookings too. */
  showCancelled: boolean;
  /** The notice from `?notice=` and `?code=` (parseBoardNotice), or null. */
  notice: { notice: Notice; code: string } | null;
  /** Everyone who may be given jobs (listMechanics). */
  mechanics: Mechanic[];
  /** Whether the viewer has "customers.contact" (the cancel notice's call links). */
  canContact: boolean;
  /** The time the page was asked for, read at request time. */
  now: Date;
  /** A fresh request token for each form (a random uuid). */
  newToken: () => string;
};

/** Each status's badge: green only for confirmed (status, never an action), red for cancelled. */
const STATUS_BADGES = {
  booked: "outline",
  confirmed: "success",
  "no-show": "secondary",
  cancelled: "destructive",
} as const satisfies Record<BookingStatus, "outline" | "success" | "secondary" | "destructive">;

/**
 * The staff bookings board, /admin/bookings (task 26): one India day's
 * bookings, each with its status, mechanic and job step, and from task 27 a
 * "Manage booking" panel to confirm, cancel, mark a no-show or assign a
 * mechanic. It only shows what it's given; its gate checks access and reads
 * the data. Everything here is plain server-rendered HTML: the day links are
 * links, the date field is a GET form and every action is a <form> posting to
 * a Server Action, so it all works without JavaScript, and no booking data
 * reaches a client component.
 *
 * Cancelled bookings are hidden unless `showCancelled`; the day's count
 * leaves them out either way. Every link and form keeps the filter.
 */
export async function BookingsBoard({
  locale,
  date,
  today,
  note,
  bookings,
  showCancelled,
  notice,
  mechanics,
  canContact,
  now,
  newToken,
}: BookingsBoardProps) {
  const t = await getTranslations({ locale, namespace: "Admin" });
  const tVehicles = await getTranslations({ locale, namespace: "Vehicles" });
  const isToday = date === today;
  const view: BoardView = { date, showCancelled };

  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
  const activeCount = bookings.length - cancelledCount;
  const shown = showCancelled ? bookings : bookings.filter((booking) => booking.status !== "cancelled");
  // Only a code that is one of this day's bookings, cancelled ones included
  // whatever the filter: the address bar can't make the board name another.
  const noticeBooking = notice ? bookings.find((booking) => booking.code === notice.code) : undefined;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 type-headline text-balance">
          {formatIndiaLongDay(date, locale)}{" "}
          {isToday && <Badge variant="secondary">{t("bookings.today")}</Badge>}
        </h1>
        {activeCount > 0 && <p className="type-lead text-muted-foreground">{t("bookings.count", { count: activeCount })}</p>}
      </div>

      {notice && noticeBooking && (
        <BoardNotice locale={locale} notice={notice.notice} booking={noticeBooking} canContact={canContact} />
      )}

      {note && <p className="rounded-xl bg-muted p-4 type-callout text-pretty">{t("bookings.dateNote")}</p>}

      <div className="flex flex-col gap-4">
        <nav aria-label={t("bookings.dayNavLabel")} className="flex flex-wrap gap-3">
          <DayLink date={addDays(date, -1)} today={today} showCancelled={showCancelled}>
            <ChevronLeftIcon data-icon="inline-start" aria-hidden />
            {t("bookings.previousDay")}
          </DayLink>
          <DayLink date={addDays(date, 1)} today={today} showCancelled={showCancelled}>
            {t("bookings.nextDay")}
            <ChevronRightIcon data-icon="inline-end" aria-hidden />
          </DayLink>
          {!isToday && (
            <Button asChild variant="outline">
              <Link href={{ pathname: "/admin/bookings", query: boardQuery({ date: null, showCancelled }) }}>
                {t("bookings.today")}
              </Link>
            </Button>
          )}
        </nav>

        {/* A plain GET form: the browser itself goes to ?date=..., no JavaScript needed.
            Keyed by the day, so the field shows the new day after a day link. */}
        <form
          key={date}
          action={getPathname({ href: "/admin/bookings", locale })}
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          {/* Keeps the filter: a GET form sends only its own fields. */}
          {showCancelled && <input type="hidden" name="cancelled" value={SHOW_CANCELLED} />}
          <Field className="w-auto">
            <FieldLabel htmlFor="board-date">{t("bookings.dateLabel")}</FieldLabel>
            <Input
              id="board-date"
              name="date"
              type="date"
              required
              defaultValue={date}
              min={boardRange(today).first}
              max={boardRange(today).last}
            />
          </Field>
          {/* Grey: the board has no main action, so no blue button. */}
          <Button type="submit" variant="secondary">
            {t("bookings.showDate")}
          </Button>
        </form>
      </div>

      {cancelledCount > 0 && (
        <p>
          <Link
            href={{ pathname: "/admin/bookings", query: boardQuery({ date, showCancelled: !showCancelled }) }}
            className="inline-flex min-h-11 items-center type-body text-link underline-offset-4 hover:underline"
          >
            {showCancelled ? t("bookings.hideCancelled") : t("bookings.showCancelled", { count: cancelledCount })}
          </Link>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="type-body text-muted-foreground">
          {cancelledCount > 0 ? t("bookings.emptyAllCancelled") : t("bookings.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((booking) => (
            <li
              key={booking.id}
              id={`booking-${booking.id}`}
              className="flex scroll-mt-6 flex-col gap-4 rounded-xl border border-border bg-card p-5 md:flex-row md:gap-8 md:p-6"
            >
              <h2 className="flex flex-wrap items-baseline gap-x-3 md:w-28 md:shrink-0 md:flex-col md:gap-1">
                <span className="type-title tabular-nums">{formatTime(booking.startsAt, locale)}</span>{" "}
                <span className="type-callout font-semibold tabular-nums text-muted-foreground">
                  {formatBookingCode(booking.code)}
                </span>
              </h2>

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-2 type-callout text-muted-foreground">
                    <Badge variant={STATUS_BADGES[booking.status]}>{t(`bookings.statuses.${booking.status}`)}</Badge>
                    <span>
                      {booking.mechanic
                        ? t("bookings.mechanic", { name: booking.mechanic.name || t("bookings.unnamedMechanic") })
                        : t("bookings.unassigned")}
                    </span>
                    <span>{t("bookings.job", { step: t(`bookings.jobSteps.${booking.jobStatus ?? "not-started"}`) })}</span>
                  </p>
                  {booking.status === "cancelled" && booking.cancelReason && (
                    <p className="type-callout text-pretty break-words">{t("bookings.cancelReason", { reason: booking.cancelReason })}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <p className="type-body font-semibold">
                    {localize(booking.vehicle.makeName, locale)} {localize(booking.vehicle.modelName, locale)}
                  </p>
                  <p className="flex flex-wrap gap-x-4 type-callout text-muted-foreground">
                    <span>{tVehicles(`fuels.${booking.vehicle.fuel}`)}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatRegistration(booking.vehicle.registrationNumber)}
                    </span>
                  </p>
                </div>

                {/* Names only: prices come with task 39. */}
                <ul className="flex flex-col gap-1 type-body">
                  {booking.lines.map((line) => {
                    const name = localize(line.name, locale);
                    return (
                      <li key={line.serviceId}>{line.kind === "package" ? t("bookings.packageLine", { name }) : name}</li>
                    );
                  })}
                </ul>

                {booking.pickup.included && (
                  <p className="flex items-center gap-2 type-callout font-semibold">
                    <TruckIcon aria-hidden className="size-5 shrink-0" />
                    {t("bookings.pickupIncluded")}
                  </p>
                )}

                <div className="flex flex-col gap-1 border-t border-border pt-4">
                  <p className="type-body font-semibold">{booking.customerName}</p>
                  {booking.phoneNumber && (
                    <a
                      href={telHref(booking.phoneNumber)}
                      className="inline-flex min-h-11 w-fit items-center gap-2 type-body text-link tabular-nums underline-offset-4 hover:underline"
                    >
                      <PhoneIcon aria-hidden className="size-5 shrink-0" />
                      {formatPhoneNumber(booking.phoneNumber)}
                    </a>
                  )}
                  {booking.pickup.address && (
                    <p className="type-callout text-pretty break-words text-muted-foreground">
                      {t("bookings.pickupFrom", {
                        address: [booking.pickup.address, booking.pickup.postalCode].filter(Boolean).join(" "),
                      })}
                    </p>
                  )}
                </div>

                <BookingManagePanel
                  locale={locale}
                  booking={booking}
                  view={view}
                  mechanics={mechanics}
                  now={now}
                  newToken={newToken}
                  notice={notice?.code === booking.code ? notice.notice : null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A previous or next day button. A day outside the board's range would be
 * refused by pickBoardDate, so it renders as a real disabled button
 * instead of a link: nothing to click, and screen readers announce it as
 * unavailable (aria-disabled on a plain span is ignored).
 */
function DayLink({
  date,
  today,
  showCancelled,
  children,
}: {
  date: IndiaDate;
  today: IndiaDate;
  showCancelled: boolean;
  children: ReactNode;
}) {
  if (!isOnBoard(date, today)) {
    return (
      <Button variant="outline" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <Link href={{ pathname: "/admin/bookings", query: boardQuery({ date, showCancelled }) }}>{children}</Link>
    </Button>
  );
}
