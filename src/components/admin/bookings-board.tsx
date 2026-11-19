import { ChevronLeftIcon, ChevronRightIcon, PhoneIcon, TruckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BOARD_RANGE_DAYS, isOnBoard } from "@/domain/board-dates";
import { formatBookingCode } from "@/domain/bookings";
import { addDays, type IndiaDate } from "@/domain/india-time";
import { formatRegistration } from "@/domain/registration";
import type { Locale } from "@/i18n/config";
import { formatIndiaLongDay, formatTime } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { getPathname, Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref } from "@/lib/contact-links";
import type { StaffBookingRow } from "@/server/dal/staff-bookings";

export type BookingsBoardProps = {
  locale: Locale;
  /** The day shown, already checked by pickBoardDate. */
  date: IndiaDate;
  /** Today in India, read at request time. */
  today: IndiaDate;
  /** True when the asked-for date couldn't be used, so `date` is today. */
  note: boolean;
  /** That day's bookings, earliest first (listBookingsOn). */
  bookings: StaffBookingRow[];
};

/**
 * The staff bookings board, /admin/bookings (task 26): one India day's
 * bookings, read-only. It only shows what it's given; its gate checks
 * access and reads the data. Everything here is plain server-rendered HTML:
 * the day links are links and the date field is a GET form, so it all works
 * without JavaScript, and no booking data reaches a client component.
 */
export async function BookingsBoard({ locale, date, today, note, bookings }: BookingsBoardProps) {
  const t = await getTranslations({ locale, namespace: "Admin" });
  const tVehicles = await getTranslations({ locale, namespace: "Vehicles" });
  const isToday = date === today;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 type-headline text-balance">
          {formatIndiaLongDay(date, locale)}{" "}
          {isToday && <Badge variant="secondary">{t("bookings.today")}</Badge>}
        </h1>
        {bookings.length > 0 && (
          <p className="type-lead text-muted-foreground">{t("bookings.count", { count: bookings.length })}</p>
        )}
      </div>

      {note && <p className="rounded-xl bg-muted p-4 type-callout text-pretty">{t("bookings.dateNote")}</p>}

      <div className="flex flex-col gap-4">
        <nav aria-label={t("bookings.dayNavLabel")} className="flex flex-wrap gap-3">
          <DayLink date={addDays(date, -1)} today={today}>
            <ChevronLeftIcon data-icon="inline-start" aria-hidden />
            {t("bookings.previousDay")}
          </DayLink>
          <DayLink date={addDays(date, 1)} today={today}>
            {t("bookings.nextDay")}
            <ChevronRightIcon data-icon="inline-end" aria-hidden />
          </DayLink>
          {!isToday && (
            <Button asChild variant="outline">
              <Link href="/admin/bookings">{t("bookings.today")}</Link>
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
          <Field className="w-auto">
            <FieldLabel htmlFor="board-date">{t("bookings.dateLabel")}</FieldLabel>
            <Input
              id="board-date"
              name="date"
              type="date"
              required
              defaultValue={date}
              min={addDays(today, -BOARD_RANGE_DAYS)}
              max={addDays(today, BOARD_RANGE_DAYS)}
            />
          </Field>
          {/* Grey: the board has no main action, so no blue button. */}
          <Button type="submit" variant="secondary">
            {t("bookings.showDate")}
          </Button>
        </form>
      </div>

      {bookings.length === 0 ? (
        <p className="type-body text-muted-foreground">{t("bookings.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 md:flex-row md:gap-8 md:p-6">
              {/* The time leads: on a phone it sits above the details, from a tablet up in its own column. */}
              <h2 className="flex flex-wrap items-baseline gap-x-3 md:w-28 md:shrink-0 md:flex-col md:gap-1">
                <span className="type-title tabular-nums">{formatTime(booking.startsAt, locale)}</span>{" "}
                <span className="type-callout font-semibold tabular-nums text-muted-foreground">
                  {formatBookingCode(booking.code)}
                </span>
              </h2>

              <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                  {/* Present only for staff with "customers.contact": the read leaves them null otherwise. */}
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
 * refused by pickBoardDate, so it renders as a disabled button-shaped span
 * instead of a link: nothing to click, and aria-disabled says why to a
 * screen reader.
 */
function DayLink({ date, today, children }: { date: IndiaDate; today: IndiaDate; children: ReactNode }) {
  if (!isOnBoard(date, today)) {
    return (
      <Button asChild variant="outline">
        <span aria-disabled="true" className="pointer-events-none opacity-50">
          {children}
        </span>
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <Link href={{ pathname: "/admin/bookings", query: { date } }}>{children}</Link>
    </Button>
  );
}
