import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type BoardNotice, type BoardView, isRefusalNotice } from "@/domain/board-dates";
import { type BookingStatus, CANCEL_REASON_RULES, canChangeStatus, formatBookingCode, isActiveStatus } from "@/domain/bookings";
import type { Locale } from "@/i18n/config";
import { assignFromBoard, changeStatusFromBoard } from "@/server/actions/admin-bookings";
import type { StaffBookingRow } from "@/server/dal/staff-bookings";
import type { Mechanic } from "@/server/dal/staff-users";

export type BookingManagePanelProps = {
  locale: Locale;
  booking: StaffBookingRow;
  /** The board's day and filter: every action returns to it. */
  view: BoardView;
  /** Everyone who may be given jobs (listMechanics), by name. */
  mechanics: Mechanic[];
  /** The time the page was asked for: decides whether a No-show is possible yet. */
  now: Date;
  /** A fresh request token for each form (a random uuid). */
  newToken: () => string;
  /** The notice the board shows, when it's about this booking. */
  notice: BoardNotice | null;
};

/** What the status buttons post as `to` (src/server/actions/admin-bookings.ts). */
type StatusButton = "confirmed" | "no-show" | "arrived";

/**
 * One booking's "Manage booking K7Q-4MX" panel on the staff board (task 27):
 * a native <details>, so it opens and closes without JavaScript, holding only
 * the actions this booking allows right now (canChangeStatus, the same check
 * the save makes). Every action is a plain <form> posting to a Server Action
 * with the booking id and the board's view bound, and a fresh request token,
 * so a double tap changes nothing twice.
 *
 * Every id is suffixed with the booking's id: the board repeats this panel on
 * each card, and two fields must never share an id. Renders nothing when the
 * booking allows no action (cancelled, or a completed job past every change).
 */
export function BookingManagePanel({ locale, booking, view, mechanics, now, newToken, notice }: BookingManagePanelProps) {
  const t = useTranslations("Admin.bookings");

  const facts = { jobStarted: booking.jobStatus !== null, slotStarted: booking.startsAt.getTime() <= now.getTime() };
  const allows = (to: BookingStatus) => canChangeStatus(booking.status, to, facts).ok;
  const statusButtons: StatusButton[] = [];
  // Confirm and "Arrived after all" both save "confirmed": which one it is
  // depends on where the booking starts.
  if (booking.status === "booked" && allows("confirmed")) statusButtons.push("confirmed");
  if (booking.status === "no-show" && allows("confirmed")) statusButtons.push("arrived");
  if (allows("no-show")) statusButtons.push("no-show");
  const canCancel = allows("cancelled");
  // Assigning stays open while the job runs (handing a job over mid-way), until it's completed.
  const canAssign = isActiveStatus(booking.status) && booking.jobStatus !== "completed";
  if (statusButtons.length === 0 && !canCancel && !canAssign) return null;

  const code = formatBookingCode(booking.code);
  const id = booking.id;
  const reasonError =
    notice === "reason-too-short"
      ? t("manage.reasonTooShort", { min: CANCEL_REASON_RULES.minLength })
      : notice === "reason-too-long"
        ? t("manage.reasonTooLong", { max: CANCEL_REASON_RULES.maxLength })
        : null;
  // Bound once: the booking and the board view travel with the form, encrypted.
  const changeStatus = changeStatusFromBoard.bind(null, locale, id, view);
  const assign = assignFromBoard.bind(null, locale, id, view);
  const statusLabels = { confirmed: t("manage.confirm"), arrived: t("manage.arrived"), "no-show": t("manage.noShow") };

  return (
    // Reopened after a refusal for this booking, so the message under the field is seen.
    <details open={notice !== null && isRefusalNotice(notice)} className="group rounded-xl border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 type-body font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        {t("manage.summary", { code })}
        <ChevronDownIcon aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <div className="flex flex-col gap-6 border-t border-border p-4">
        {statusButtons.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {statusButtons.map((button) => (
              <form key={button} action={changeStatus}>
                <input type="hidden" name="to" value={button} />
                <input type="hidden" name="code" value={booking.code} />
                <input type="hidden" name="requestToken" value={newToken()} />
                {/* Confirm is the panel's one blue button; the rest are outlines. */}
                <Button type="submit" variant={button === "confirmed" ? "default" : "outline"}>
                  {statusLabels[button]}
                </Button>
              </form>
            ))}
          </div>
        )}

        {canCancel && (
          <form action={changeStatus} className="flex flex-col gap-3">
            <input type="hidden" name="to" value="cancelled" />
            <input type="hidden" name="code" value={booking.code} />
            <input type="hidden" name="requestToken" value={newToken()} />
            <Field data-invalid={reasonError !== null || undefined}>
              <FieldLabel htmlFor={`cancel-reason-${id}`}>{t("manage.reasonLabel")}</FieldLabel>
              <Textarea
                id={`cancel-reason-${id}`}
                name="reason"
                required
                minLength={CANCEL_REASON_RULES.minLength}
                maxLength={CANCEL_REASON_RULES.maxLength}
                aria-invalid={reasonError !== null || undefined}
                aria-describedby={reasonError ? `cancel-reason-hint-${id} cancel-reason-error-${id}` : `cancel-reason-hint-${id}`}
              />
              <FieldDescription id={`cancel-reason-hint-${id}`}>
                {t("manage.reasonHint", { min: CANCEL_REASON_RULES.minLength, max: CANCEL_REASON_RULES.maxLength })}
              </FieldDescription>
              {reasonError && <FieldError id={`cancel-reason-error-${id}`}>{reasonError}</FieldError>}
            </Field>
            <Button type="submit" variant="destructive" className="w-fit">
              {t("manage.cancel")}
            </Button>
          </form>
        )}

        {canAssign && (
          <AssignForm
            id={id}
            code={booking.code}
            action={assign}
            mechanics={mechanics}
            current={booking.mechanic}
            token={newToken}
            labels={{
              mechanic: t("manage.mechanicLabel"),
              nobody: t("manage.nobody"),
              save: t("manage.saveMechanic"),
              noMechanics: t("manage.noMechanics"),
              unnamed: t("unnamedMechanic"),
            }}
          />
        )}
      </div>
    </details>
  );
}

type AssignFormProps = {
  id: string;
  /** The stored booking code, for the notice if the form is refused. */
  code: string;
  action: (formData: FormData) => Promise<void>;
  mechanics: Mechanic[];
  current: StaffBookingRow["mechanic"];
  token: () => string;
  labels: { mechanic: string; nobody: string; save: string; noMechanics: string; unnamed: string };
};

/**
 * The mechanic choice: a native select with the current mechanic chosen.
 * The current one is listed even when they're no longer a mechanic, so the
 * select never silently shows someone else. With nobody to choose and nobody
 * assigned there's nothing to save, so it says so instead.
 */
function AssignForm({ id, code, action, mechanics, current, token, labels }: AssignFormProps) {
  if (mechanics.length === 0 && current === null) return <p className="type-callout text-muted-foreground">{labels.noMechanics}</p>;
  const options = current && !mechanics.some((mechanic) => mechanic.id === current.id) ? [current, ...mechanics] : mechanics;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="requestToken" value={token()} />
      <Field>
        <FieldLabel htmlFor={`mechanic-${id}`}>{labels.mechanic}</FieldLabel>
        <NativeSelect id={`mechanic-${id}`} name="mechanicId" defaultValue={current?.id ?? ""} className="md:max-w-xs">
          <NativeSelectOption value="">{labels.nobody}</NativeSelectOption>
          {options.map((mechanic) => (
            <NativeSelectOption key={mechanic.id} value={mechanic.id}>
              {mechanic.name || labels.unnamed}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" variant="outline" className="w-fit">
        {labels.save}
      </Button>
    </form>
  );
}
