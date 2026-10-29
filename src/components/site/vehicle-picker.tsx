"use client";

import { useLocale } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { ChoiceGroup } from "@/components/site/choice-group";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import {
  changeSelection,
  EMPTY_SELECTION,
  findMake,
  findModel,
  type Fuel,
  FUELS,
  normalizeSelection,
  type SelectionChange,
  type VehicleCatalogue,
  type VehicleField,
  type VehicleKind,
  VEHICLE_KINDS,
  vehicleOptions,
  type VehicleSelection,
} from "@/domain/vehicles";
import { localize } from "@/i18n/localized-text";
import { cn } from "@/lib/utils";

/**
 * Every word the picker shows, from messages/en.json (the Vehicles
 * namespace): vehiclePickerLabels() builds it on the server. Templates keep
 * their {placeholders}: the picker fills them in.
 */
export type VehiclePickerLabels = {
  kindLegend: string;
  kinds: Record<VehicleKind, string>;
  makeLabel: string;
  makePlaceholder: string;
  /** The brand list's groups while no type is chosen: "Cars", "Two-wheelers". */
  makeGroups: Record<VehicleKind, string>;
  modelLabel: string;
  modelPlaceholder: string;
  /** A model group's name while both kinds are listed: "{brand} ({kind})". */
  modelGroup: string;
  fuelLegend: string;
  fuels: Record<Fuel, string>;
  /** Said when the picker fills a field in by itself: "{field} set to {value}". */
  announceSet: string;
  /** Said when the picker clears a field by itself: "{field} cleared". */
  announceCleared: string;
};

type VehiclePickerProps = {
  /** The listed catalogue (readVehicleCatalogue()). Don't show the picker when it's empty. */
  catalogue: VehicleCatalogue;
  labels: VehiclePickerLabels;
  /**
   * The start of the form field names: "vehicle" posts vehicleKind,
   * vehicleMake, vehicleModel and vehicleFuel.
   */
  name?: string;
  /** A choice to start from, such as a saved vehicle (task 21). */
  defaultValue?: Partial<VehicleSelection>;
  /** Called with every new choice. */
  onChange?: (selection: VehicleSelection) => void;
  /** An error under the picker, saying how to fix it. It also marks the model field invalid. */
  error?: ReactNode;
  className?: string;
};

/** "{field} set to {value}" with the values put in. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

// Never changes: the picker only needs to know whether it has hydrated.
const subscribeToNothing = () => () => {};

/** `value` if it's one of `allowed`, else null. */
function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | null {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : null;
}

/**
 * What the picker's fields in the page show right now, or null when they
 * aren't in the page. It runs during the first render in the browser, while
 * React hydrates the server's HTML: the only moment a choice made before the
 * page's JavaScript loaded can still be read: React then sets the fields to
 * what this render says. (`id` is useId's: the same on the server and while
 * hydrating, so it finds this picker's own fields.)
 */
function fieldsInPage(id: string, name: string): VehicleSelection | null {
  if (typeof document === "undefined") return null;
  const picker = document.getElementById(`${id}-model`)?.closest('[data-slot="vehicle-picker"]');
  if (!picker) return null;
  const value = (selector: string) => picker.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value || undefined;
  return {
    kind: oneOf(VEHICLE_KINDS, value(`input[name="${name}Kind"]:checked`)),
    makeId: value(`select[name="${name}Make"]`) ?? null,
    modelId: value(`select[name="${name}Model"]`) ?? null,
    fuel: oneOf(FUELS, value(`input[name="${name}Fuel"]:checked`)),
  };
}

const sameSelection = (a: VehicleSelection, b: VehicleSelection) =>
  a.kind === b.kind && a.makeId === b.makeId && a.modelId === b.modelId && a.fuel === b.fuel;

/**
 * The vehicle picker: type, then brand, then model, then fuel.
 *
 * - Native controls (radios and selects), so it posts inside a plain form.
 *   The first render (on the server, and again while hydrating) always shows
 *   the full lists, with any default selected, so a visitor without
 *   JavaScript can still pick any brand and model. Narrowing starts once the
 *   picker has hydrated.
 * - A choice made while the page's JavaScript is still loading is kept
 *   (task 21). React 19 sets the fields back to what the first render says
 *   when it hydrates them, so the picker reads them just before
 *   (fieldsInPage) and starts from what they showed. (React doesn't compare
 *   a field's value or checked state with the server's HTML, so this causes
 *   no hydration warning; the picker test checks it.)
 * - Inside a form, a reset (the form's reset() or React's own reset after a
 *   form action) puts the picker back to its defaultValue, so what it shows
 *   and what the form posts never drift apart.
 * - The rules live in src/domain/vehicles.ts: each list is complete until an
 *   earlier choice narrows it, a model fills in its brand and type, and a
 *   choice that no longer fits is cleared. Only matching options are
 *   rendered (iOS Safari ignores hidden <option>s).
 * - When the picker changes a field by itself, a polite live region says so
 *   ("Brand set to Honda", "Model cleared") for screen reader users.
 */
export function VehiclePicker({
  catalogue,
  labels,
  name = "vehicle",
  defaultValue,
  onChange,
  error,
  className,
}: VehiclePickerProps) {
  const locale = useLocale();
  const id = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  // The default, made consistent: where the picker starts, and where a form
  // reset takes it back.
  const [start] = useState(() => normalizeSelection(catalogue, { ...EMPTY_SELECTION, ...defaultValue }));
  // A choice already in the page's fields wins over the default.
  const [selection, setSelection] = useState(() => {
    const inPage = fieldsInPage(id, name);
    return inPage ? normalizeSelection(catalogue, inPage) : start;
  });
  const [announcement, setAnnouncement] = useState("");
  // false on the server and while hydrating, true afterwards.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  // Tell the parent about a choice kept from before hydration, once.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (!sameSelection(selection, start)) onChangeRef.current?.(selection);
    // Only the choice found while hydrating: later ones call onChange in choose().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A form reset puts the fields back to the server's defaults, so the
  // picker goes back to its own default too.
  useEffect(() => {
    const form = pickerRef.current?.closest("form");
    if (!form) return;
    const backToStart = () => {
      setSelection({ ...start });
      setAnnouncement("");
    };
    form.addEventListener("reset", backToStart);
    return () => form.removeEventListener("reset", backToStart);
  }, [start]);

  const options = vehicleOptions(catalogue, hydrated ? selection : EMPTY_SELECTION);
  const bothKindsListed = new Set(options.makes.map((make) => make.kind)).size > 1;
  const errorId = `${id}-error`;

  const fieldName: Record<VehicleField, string> = {
    kind: labels.kindLegend,
    make: labels.makeLabel,
    model: labels.modelLabel,
    fuel: labels.fuelLegend,
  };

  /** The words for a field's value in `next`, or null when it's empty. */
  function valueText(field: VehicleField, next: VehicleSelection): string | null {
    switch (field) {
      case "kind":
        return next.kind && labels.kinds[next.kind];
      case "make": {
        const make = findMake(catalogue, next.makeId);
        return make ? localize(make.name, locale) : null;
      }
      case "model": {
        const found = findModel(catalogue, next.modelId);
        return found ? localize(found.model.name, locale) : null;
      }
      case "fuel":
        return next.fuel && labels.fuels[next.fuel];
    }
  }

  function choose(change: SelectionChange) {
    const result = changeSelection(catalogue, selection, change);
    setSelection(result.selection);
    setAnnouncement(
      result.changed
        .map((field) => {
          const value = valueText(field, result.selection);
          return value === null
            ? fill(labels.announceCleared, { field: fieldName[field] })
            : fill(labels.announceSet, { field: fieldName[field], value });
        })
        .join(". "),
    );
    onChange?.(result.selection);
  }

  const makeOption = (make: (typeof options.makes)[number]) => (
    <NativeSelectOption key={make.id} value={make.id}>
      {localize(make.name, locale)}
    </NativeSelectOption>
  );

  return (
    <div ref={pickerRef} data-slot="vehicle-picker" className={cn("flex flex-col gap-6", className)}>
      <ChoiceGroup
        legend={labels.kindLegend}
        name={`${name}Kind`}
        options={options.kinds.map((kind) => ({ value: kind, label: labels.kinds[kind] }))}
        value={selection.kind}
        onChange={(kind) => choose({ field: "kind", value: kind })}
      />

      <Field>
        <FieldLabel htmlFor={`${id}-make`}>{labels.makeLabel}</FieldLabel>
        <NativeSelect
          id={`${id}-make`}
          name={`${name}Make`}
          value={selection.makeId ?? ""}
          onChange={(event) => choose({ field: "make", value: event.target.value || null })}
        >
          <NativeSelectOption value="">{labels.makePlaceholder}</NativeSelectOption>
          {bothKindsListed
            ? options.kinds.map((kind) => (
                <NativeSelectOptGroup key={kind} label={labels.makeGroups[kind]}>
                  {options.makes.filter((make) => make.kind === kind).map(makeOption)}
                </NativeSelectOptGroup>
              ))
            : options.makes.map(makeOption)}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${id}-model`}>{labels.modelLabel}</FieldLabel>
        <NativeSelect
          id={`${id}-model`}
          name={`${name}Model`}
          value={selection.modelId ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => choose({ field: "model", value: event.target.value || null })}
        >
          <NativeSelectOption value="">{labels.modelPlaceholder}</NativeSelectOption>
          {options.modelGroups.map(({ make, models }) => (
            <NativeSelectOptGroup
              key={make.id}
              label={
                bothKindsListed
                  ? fill(labels.modelGroup, { brand: localize(make.name, locale), kind: labels.kinds[make.kind] })
                  : localize(make.name, locale)
              }
            >
              {models.map((model) => (
                <NativeSelectOption key={model.id} value={model.id}>
                  {localize(model.name, locale)}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </Field>

      <ChoiceGroup
        legend={labels.fuelLegend}
        name={`${name}Fuel`}
        options={options.fuels.map((fuel) => ({ value: fuel, label: labels.fuels[fuel] }))}
        value={selection.fuel}
        onChange={(fuel) => choose({ field: "fuel", value: fuel })}
      />

      {error && <FieldError id={errorId}>{error}</FieldError>}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
