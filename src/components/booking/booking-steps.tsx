"use client";

// The wizard's first three steps. Each reports every change up; booking-wizard.tsx keeps the state, so a step can unmount without losing anything.

import { useLocale } from "next-intl";
import { type ReactNode, useId, useMemo } from "react";

import { type BookingWizardLabels, fill, linePriceText } from "@/components/booking/booking-labels";
import type { OfferedService } from "@/components/booking/booking-prices";
import { CheckboxField } from "@/components/site/checkbox-field";
import { ChoiceGroup } from "@/components/site/choice-group";
import { VehiclePicker, type VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Service } from "@/domain/services";
import { EMPTY_SELECTION, type VehicleCatalogue, type VehicleSelection } from "@/domain/vehicles";
import { formatRegistration } from "@/domain/registration";
import { formatIndiaDay, formatTime } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import type { ConfirmErrors, SerializedSlotDay } from "@/lib/booking-form";
import type { MyVehicle } from "@/server/dal/customer-vehicles";

/** The vehicle being booked: one the customer saved, or one picked and typed here. */
export type VehicleChoice =
  | { kind: "saved"; vehicleId: string }
  | { kind: "typed"; selection: VehicleSelection; registration: string };

export const BLANK_TYPED_VEHICLE: VehicleChoice = { kind: "typed", selection: EMPTY_SELECTION, registration: "" };

export function savedVehicleText(vehicle: MyVehicle, locale: string): string {
  return `${localize(vehicle.makeName, locale)} ${localize(vehicle.modelName, locale)}, ${formatRegistration(vehicle.registrationNumber)}`;
}

/** "a b" from the ids that are set: the value of an aria-describedby. */
export function ids(...list: (string | false | undefined)[]): string | undefined {
  return list.filter(Boolean).join(" ") || undefined;
}

export function VehicleStep({
  id,
  choice,
  onChoice,
  savedVehicles,
  catalogue,
  labels,
  pickerLabels,
  errors,
}: {
  /** The wizard's useId: the registration field's id starts with it. */
  id: string;
  choice: VehicleChoice;
  onChoice: (choice: VehicleChoice) => void;
  savedVehicles: readonly MyVehicle[];
  catalogue: VehicleCatalogue;
  labels: BookingWizardLabels;
  pickerLabels: VehiclePickerLabels;
  errors: ConfirmErrors;
}) {
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-8">
      {savedVehicles.length > 0 && (
        <ChoiceGroup
          legend={labels.savedLegend}
          name="savedVehicle"
          options={[
            ...savedVehicles.map((vehicle) => ({ value: vehicle.id, label: savedVehicleText(vehicle, locale) })),
            { value: "new", label: labels.anotherVehicle },
          ]}
          value={choice.kind === "saved" ? choice.vehicleId : "new"}
          onChange={(value) =>
            onChoice(value === "new" ? BLANK_TYPED_VEHICLE : { kind: "saved", vehicleId: value })
          }
        />
      )}
      {choice.kind === "saved" && errors.vehicle && <FieldError>{errors.vehicle}</FieldError>}

      {choice.kind === "typed" && (
        <>
          <VehiclePicker
            catalogue={catalogue}
            labels={pickerLabels}
            defaultValue={choice.selection}
            onChange={(selection) => onChoice({ ...choice, selection })}
            error={errors.vehicle}
          />
          <Field data-invalid={errors.registration ? true : undefined}>
            <FieldLabel htmlFor={`${id}-registration`}>{labels.registrationLabel}</FieldLabel>
            {/* Plain text, capitals on phones, no autocorrect: same field as the add-vehicle form. */}
            <Input
              id={`${id}-registration`}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={choice.registration}
              onChange={(event) => onChoice({ ...choice, registration: event.target.value })}
              aria-invalid={errors.registration ? true : undefined}
              aria-describedby={ids(`${id}-registration-hint`, errors.registration && `${id}-registration-error`)}
            />
            <FieldDescription id={`${id}-registration-hint`}>{labels.registrationHint}</FieldDescription>
            {errors.registration && (
              <FieldError id={`${id}-registration-error`}>{errors.registration}</FieldError>
            )}
          </Field>
        </>
      )}
    </div>
  );
}

export function ServicesStep({
  offered,
  chosen,
  onToggle,
  atLimit,
  labels,
  error,
  contactLinks,
}: {
  offered: readonly OfferedService[];
  chosen: readonly string[];
  onToggle: (service: Service, checked: boolean) => void;
  /** As many services as one booking holds are chosen: the others are disabled. */
  atLimit: boolean;
  labels: BookingWizardLabels;
  error: string | undefined;
  contactLinks: ReactNode;
}) {
  const locale = useLocale();
  if (offered.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="type-body">{labels.noServices}</p>
        {contactLinks}
      </div>
    );
  }

  const group = (kind: Service["kind"], legend: string, hint?: string) => {
    const items = offered.filter((item) => item.service.kind === kind);
    if (items.length === 0) return null;
    return (
      <FieldSet className="gap-0">
        <FieldLegend variant="label">{legend}</FieldLegend>
        {hint && <p className="pb-2 type-callout text-muted-foreground">{hint}</p>}
        {items.map((item) => {
          const checked = chosen.includes(item.service.id);
          return (
            <CheckboxField
              key={item.service.id}
              checked={checked}
              disabled={!checked && atLimit && kind === "service"}
              onChange={(event) => onToggle(item.service, event.target.checked)}
              label={
                <span className="flex flex-col">
                  <span>{localize(item.service.name, locale)}</span>
                  <span className="type-callout text-muted-foreground">{linePriceText(item, labels, locale)}</span>
                </span>
              }
            />
          );
        })}
      </FieldSet>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {group("package", labels.packagesLegend, labels.packagesHint)}
      {group("service", labels.servicesLegend)}
      {atLimit && <p className="type-callout text-muted-foreground">{fill(labels.atMost, { max: chosen.length })}</p>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

/** An open day with at least one place left. */
export function hasFreeSlot(day: SerializedSlotDay): day is Extract<SerializedSlotDay, { status: "open" }> {
  return day.status === "open" && day.slots.some((slot) => slot.remaining > 0);
}

export function SlotStep({
  days,
  day,
  onDay,
  startsAt,
  onTime,
  labels,
  error,
  contactLinks,
}: {
  days: readonly SerializedSlotDay[];
  /** The day whose times show: a day with a free slot, or none when there's none. */
  day: string | null;
  onDay: (date: string) => void;
  startsAt: string | null;
  onTime: (startsAt: string) => void;
  labels: BookingWizardLabels;
  error: string | undefined;
  contactLinks: ReactNode;
}) {
  const locale = useLocale();
  const shown = days.find((each) => each.date === day);
  const text = useMemo(() => {
    const dayText = new Map<string, string>();
    const timeText = new Map<string, string>();
    for (const each of days) {
      dayText.set(each.date, formatIndiaDay(each.date, locale));
      if (each.status !== "open") continue;
      for (const slot of each.slots) timeText.set(slot.startsAt, formatTime(new Date(slot.startsAt), locale));
    }
    return { dayText, timeText };
  }, [days, locale]);

  if (!shown || !hasFreeSlot(shown)) {
    return (
      <div className="flex flex-col gap-4">
        {error && <FieldError>{error}</FieldError>}
        <p className="type-body">{labels.noSlots}</p>
        {contactLinks}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <FieldError>{error}</FieldError>}
      <ChoiceGroup
        legend={labels.dayLegend}
        name="slotDay"
        value={shown.date}
        onChange={onDay}
        options={days.map((each) => {
          const open = each.status === "open";
          const free = hasFreeSlot(each);
          return {
            value: each.date,
            disabled: !free,
            label: (
              <span className="flex flex-col items-center py-1">
                <span>{text.dayText.get(each.date)}</span>
                {!free && (
                  <span className="type-caption">{open ? labels.full : labels.closed}</span>
                )}
              </span>
            ),
          };
        })}
      />
      <div className="flex flex-col gap-2">
        <ChoiceGroup
          legend={labels.timeLegend}
          name="slotTime"
          value={startsAt}
          onChange={onTime}
          options={shown.slots
            .filter((slot) => slot.remaining > 0)
            .map((slot) => ({ value: slot.startsAt, label: text.timeText.get(slot.startsAt) }))}
        />
        <p className="type-callout text-muted-foreground">{labels.timesNote}</p>
      </div>
    </div>
  );
}

/** Back (if there's a step before), then the main button, first on phones (under the thumb). When the step isn't ready, the reason sits beside the disabled button. */
export function StepActions({
  labels,
  onBack,
  next,
  children,
}: {
  labels: BookingWizardLabels;
  onBack?: () => void;
  /** The step's Continue button: disabled, with its reason in words, until the step is ready. */
  next?: { ready: boolean; reason: string; onContinue: () => void };
  children?: ReactNode;
}) {
  const reasonId = useId();
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      {onBack && (
        <Button type="button" variant="secondary" className="w-full sm:mr-auto sm:w-fit" onClick={onBack}>
          {labels.back}
        </Button>
      )}
      {next && !next.ready && (
        <p id={reasonId} className="type-callout text-muted-foreground">
          {next.reason}
        </p>
      )}
      {next && (
        <Button
          type="button"
          className="w-full sm:w-fit"
          disabled={!next.ready}
          aria-describedby={next.ready ? undefined : reasonId}
          onClick={next.onContinue}
        >
          {labels.continue}
        </Button>
      )}
      {children}
    </div>
  );
}
