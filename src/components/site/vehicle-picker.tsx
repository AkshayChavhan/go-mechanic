"use client";

import { useLocale } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";

import { ChoiceGroup } from "@/components/site/choice-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import {
  changeSelection,
  EMPTY_SELECTION,
  type Fuel,
  normalizeSelection,
  type SelectionChange,
  type VehicleCatalogue,
  type VehicleField,
  type VehicleKind,
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
  className?: string;
};

/** "{field} set to {value}" with the values put in. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

// Never changes: the picker only needs to know whether it has hydrated.
const subscribeToNothing = () => () => {};

/**
 * The vehicle picker: type, then brand, then model, then fuel.
 *
 * - Native controls (radios and selects), so it posts inside a plain form,
 *   and works before its JavaScript has loaded: the first render (on the
 *   server, and again while hydrating) always shows the full lists, with any
 *   default selected, so a visitor without JavaScript can still pick any
 *   brand and model. Narrowing starts once the picker has hydrated.
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
  className,
}: VehiclePickerProps) {
  const locale = useLocale();
  const id = useId();
  const [selection, setSelection] = useState(() =>
    normalizeSelection(catalogue, { ...EMPTY_SELECTION, ...defaultValue }),
  );
  const [announcement, setAnnouncement] = useState("");
  // false on the server and while hydrating, true afterwards.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const options = vehicleOptions(catalogue, hydrated ? selection : EMPTY_SELECTION);
  const bothKindsListed = new Set(options.makes.map((make) => make.kind)).size > 1;

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
        const make = catalogue.makes.find((candidate) => candidate.id === next.makeId);
        return make ? localize(make.name, locale) : null;
      }
      case "model": {
        const model = catalogue.makes.flatMap((make) => make.models).find((candidate) => candidate.id === next.modelId);
        return model ? localize(model.name, locale) : null;
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
    <div data-slot="vehicle-picker" className={cn("flex flex-col gap-6", className)}>
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

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
