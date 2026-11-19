import { StarIcon } from "lucide-react";
import type { ReactNode } from "react";

import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { RATINGS, type Rating } from "@/domain/reviews";
import { cn } from "@/lib/utils";

type StarRatingInputProps = {
  /** What the group asks: "Your rating". */
  legend: ReactNode;
  /** The radios' form field name: what the form posts ("1" to "5"). */
  name: string;
  /** Each star's name for screen readers, from messages: "3 out of 5 stars". */
  starLabels: Record<Rating, string>;
  /** The chosen rating, for a parent that keeps the state (null: none yet). */
  value?: Rating | null;
  onChange?: (value: Rating) => void;
  /** A message under the stars, and the group marked invalid. */
  error?: string;
  errorId?: string;
};

/**
 * One to five stars, as five native radios in a fieldset (task 37).
 *
 * - Native radios, like ChoiceGroup: they can be chosen before the page's
 *   JavaScript has loaded, post with the form, and the arrow keys move
 *   between them.
 * - Each radio sits inside its star's <label>, visually hidden, so the whole
 *   44px square is the target. The label draws the focus ring, since the
 *   radio is invisible.
 * - Stars fill up to the chosen one by CSS alone (a star is filled when its
 *   own radio, or one after it, is checked), so it works before hydration
 *   too. Filled and outlined stars differ in shape, not only in colour.
 * - Each radio has a name ("3 out of 5 stars"); the stars are decorative.
 */
export function StarRatingInput({ legend, name, starLabels, value, onChange, error, errorId }: StarRatingInputProps) {
  const controlled = value !== undefined;

  return (
    <FieldSet data-slot="star-rating" data-invalid={error ? true : undefined} className="min-w-0 gap-0">
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="flex gap-1" aria-describedby={error ? errorId : undefined}>
        {RATINGS.map((rating) => (
          <label
            key={rating}
            className={cn(
              "inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
              "hover:bg-accent",
              // Filled: this star's radio, or a later star's, is checked.
              "has-checked:text-foreground has-[~label_input:checked]:text-foreground",
              "[&:has(input:checked)_svg]:fill-current [&:has(~label_input:checked)_svg]:fill-current",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={String(rating)}
              aria-label={starLabels[rating]}
              {...(controlled ? { checked: rating === value } : {})}
              {...(onChange ? { onChange: () => onChange(rating) } : { readOnly: controlled })}
            />
            <StarIcon aria-hidden="true" className="size-8" />
          </label>
        ))}
      </div>
      {error && (
        <FieldError id={errorId} className="mt-2">
          {error}
        </FieldError>
      )}
    </FieldSet>
  );
}
