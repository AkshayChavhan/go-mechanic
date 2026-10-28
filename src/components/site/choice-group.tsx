import type { ReactNode } from "react";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type ChoiceOption<Value extends string> = {
  value: Value;
  /** What the pill says: "Car", "Petrol". */
  label: ReactNode;
};

type ChoiceGroupProps<Value extends string> = {
  /** What the group asks, as a short label: "Fuel". */
  legend: ReactNode;
  /** The radios' form field name: what the form posts. */
  name: string;
  options: readonly ChoiceOption<Value>[];
  /**
   * The checked option, for a group whose parent keeps the state (null: none
   * yet). Leave it out and use defaultValue to let the radios keep it.
   */
  value?: Value | null;
  /** The option checked at first, when `value` isn't given. */
  defaultValue?: Value;
  /** Called with the option's value when it's chosen. Needed with `value`. */
  onChange?: (value: Value) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * One question answered by a row of pills: a car or a two-wheeler, petrol or
 * diesel.
 *
 * - Native radios, not a Radix radio group: they can be chosen before the
 *   page's JavaScript has loaded, they post with the form, and the arrow
 *   keys move between them (the browser does it, as for any radios sharing
 *   a name).
 * - Each radio sits inside its pill's <label> and is visually hidden, so the
 *   whole pill is the target, at least 44px tall. The pill draws the focus
 *   ring itself (has-[:focus-visible]), since the radio it belongs to is
 *   invisible.
 * - The chosen pill is filled with the text colour, not the blue: blue is for
 *   actions (one blue button per group), and a pale fill wouldn't reach the
 *   3:1 contrast a chosen state needs.
 */
export function ChoiceGroup<Value extends string>({
  legend,
  name,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
}: ChoiceGroupProps<Value>) {
  const controlled = value !== undefined;

  return (
    <FieldSet data-slot="choice-group" className={cn("min-w-0 gap-0", className)} disabled={disabled}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input px-5 type-body transition-colors",
              "not-has-checked:hover:bg-accent has-checked:border-foreground has-checked:bg-foreground has-checked:text-background",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              "has-disabled:cursor-not-allowed has-disabled:opacity-50",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              {...(controlled ? { checked: option.value === value } : { defaultChecked: option.value === defaultValue })}
              // Only when a parent listens: a server-rendered group (no
              // JavaScript of its own, like the /dev/design sample) can't
              // carry an event handler.
              {...(onChange ? { onChange: () => onChange(option.value) } : { readOnly: controlled })}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldSet>
  );
}
