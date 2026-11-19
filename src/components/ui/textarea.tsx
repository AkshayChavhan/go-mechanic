// Our changes to shadcn's radix-nova textarea (restyle.test.tsx checks them),
// the same as the input's (input.tsx):
// - At least 132px tall (min-h-33), three lines of 17px text, and it grows
//   with what's typed (field-sizing-content).
// - 17px text (type-body) on every screen: shadcn's md:text-sm made it 14px on
//   wider screens, and iOS Safari zooms into fields with text under 16px.
// - No grey fill inside .dark sections: placeholder text on it was under 4.5:1.
//   The --input border (3:1 on every surface) shows where the field is.
// - An invalid field keeps the full --destructive border inside .dark sections
//   (shadcn faded it to 50%, about 2.2:1 on black; a border needs 3:1).
import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-33 w-full rounded-lg border border-input bg-transparent px-3 py-2.5 type-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
