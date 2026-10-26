// Our changes to shadcn's radix-nova input (restyle.test.tsx checks them):
// - 44px tall (h-11), the same height as the default button.
// - 17px text (type-body) on every screen: shadcn's md:text-sm made it 14px on
//   wider screens, and iOS Safari zooms into fields with text under 16px.
// - No grey fill inside .dark sections: placeholder text on it was under 4.5:1.
//   The --input border (3:1 on every surface) shows where the field is.
// - An invalid field keeps the full --destructive border inside .dark sections
//   (shadcn faded it to 50%, about 2.2:1 on black; a border needs 3:1).
import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 type-body transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
