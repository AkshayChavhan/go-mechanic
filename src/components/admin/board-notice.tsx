import { CircleAlertIcon, CircleCheckIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { type BoardNotice as Notice, isRefusalNotice } from "@/domain/board-dates";
import { CANCEL_REASON_RULES, formatBookingCode } from "@/domain/bookings";
import type { Locale } from "@/i18n/config";
import { formatDate, formatTime } from "@/i18n/format";
import { telHref, whatsappHref } from "@/lib/contact-links";
import type { StaffBookingRow } from "@/server/dal/staff-bookings";

export type BoardNoticeProps = {
  locale: Locale;
  notice: Notice;
  /** The booking the notice is about, found by its code in the day's bookings. */
  booking: StaffBookingRow;
  /** Whether the viewer has "customers.contact": only then the call links. */
  canContact: boolean;
};

/**
 * The line under the board's heading after an action (task 27, the plan's
 * KTD13). A saved change is a status message; a refusal is an alert with a
 * "Not saved" line and what to do next. Both start with an icon, so colour is
 * never the only sign, and both name the booking by its own code (never the
 * one in the address bar).
 *
 * After a cancel the customer hears nothing from the website yet (tasks 25
 * and 35), so the notice reminds staff to tell them, with tap-to-call and
 * WhatsApp links for staff allowed to contact customers. The links are here,
 * not only on the card, because a cancelled card is hidden by default.
 */
export function BoardNotice({ locale, notice, booking, canContact }: BoardNoticeProps) {
  const t = useTranslations("Admin.bookings");
  const code = formatBookingCode(booking.code);
  const refused = isRefusalNotice(notice);
  const Icon = refused ? CircleAlertIcon : CircleCheckIcon;

  let message: string;
  switch (notice) {
    case "assigned":
      message = booking.mechanic
        ? t("notices.assigned", { code, mechanic: booking.mechanic.name || t("unnamedMechanic") })
        : t("notices.unassigned", { code });
      break;
    case "changed":
      message = t("notices.changed", { code, status: t(`statuses.${booking.status}`).toLowerCase() });
      break;
    case "job-moved":
    case "job-step-changed":
      // The job's step as it is now (after the move, or after someone else's).
      message = t(`notices.${notice}`, { code, step: t(`jobSteps.${booking.jobStatus ?? "not-started"}`) });
      break;
    case "too-early":
      message = t("notices.too-early", { code, time: formatTime(booking.startsAt, locale) });
      break;
    case "reason-too-short":
      message = t("notices.reason-too-short", { code, min: CANCEL_REASON_RULES.minLength });
      break;
    case "reason-too-long":
      message = t("notices.reason-too-long", { code, max: CANCEL_REASON_RULES.maxLength });
      break;
    default:
      message = t(`notices.${notice}`, { code });
  }

  const name = booking.customerName;
  const phone = canContact ? booking.phoneNumber : null;

  return (
    <div role={refused ? "alert" : "status"} className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <Icon aria-hidden className={refused ? "mt-0.5 size-5 shrink-0 text-destructive" : "mt-0.5 size-5 shrink-0 text-success"} />
      <div className="flex min-w-0 flex-col gap-2">
        {refused && <p className="type-callout font-semibold text-destructive">{t("notices.refused")}</p>}
        <p className="type-body text-pretty">{message}</p>
        {notice === "cancelled" && (
          <>
            <p className="type-body text-pretty">{t("notices.callReminder", { name })}</p>
            {phone && (
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <a href={telHref(phone)}>
                    <PhoneIcon data-icon="inline-start" aria-hidden />
                    {t("notices.call", { name })}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={whatsappHref(
                      phone,
                      t("notices.whatsappMessage", {
                        name,
                        code,
                        day: formatDate(booking.startsAt, locale),
                        time: formatTime(booking.startsAt, locale),
                      }),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircleIcon data-icon="inline-start" aria-hidden />
                    {t("notices.whatsapp", { name })}
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
