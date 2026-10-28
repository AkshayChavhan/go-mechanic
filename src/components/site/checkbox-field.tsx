import { useId, type ComponentProps, type ReactNode } from "react";

import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type CheckboxFieldProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  /** What ticking the box means, as a full sentence: "I am 18 or older." */
  label: ReactNode;
  /** An error under the row, saying how to fix it. It also marks the box invalid. */
  error?: ReactNode;
};

/**
 * One checkbox and its label, as a single row a thumb can hit.
 *
 * - A native <input type="checkbox">, not shadcn's Checkbox (a Radix button):
 *   a native box can be ticked before the page's JavaScript has loaded, and
 *   its ticked state is sent with the form like any other field.
 * - The <label> wraps the box and the text, so pressing anywhere on the row
 *   ticks it. The row is at least 44px tall (min-h-11), the touch-target rule.
 * - The box is coloured with accent-color (accent-primary), the one way to
 *   colour a native checkbox without redrawing it: blue when ticked.
 * - The box sits in a span one line tall (h-lh: the height of one line of the
 *   label's text), so it stays centred on the first line however long the
 *   label is, in English or in Hindi (taller lines).
 * - Every other prop (name, required, defaultChecked, aria-describedby...)
 *   goes to the <input>, so it works inside any form.
 */
export function CheckboxField({
  label,
  error,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: CheckboxFieldProps) {
  const errorId = useId();
  // The error joins whatever the caller already points to (a shared error
  // or a notice under a group of boxes).
  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="checkbox-field" className={cn("flex flex-col gap-1", className)}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5 type-body">
        <span className="flex h-lh shrink-0 items-center">
          <input
            type="checkbox"
            aria-invalid={error ? true : invalid}
            aria-describedby={describedByIds}
            className="size-5 cursor-pointer accent-primary aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-destructive"
            {...props}
          />
        </span>
        <span>{label}</span>
      </label>
      {/* pl-8: the box (20px) plus the gap (12px), so the error lines up with the label's text. */}
      {error && (
        <FieldError id={errorId} className="pl-8">
          {error}
        </FieldError>
      )}
    </div>
  );
}
