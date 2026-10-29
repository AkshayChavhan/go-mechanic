// Our changes to shadcn's radix-nova native-select (restyle.test.tsx checks them):
// - 44px tall (h-11) and 17px text (type-body), like Input: iOS Safari zooms
//   into fields with text under 16px. shadcn's small size (28px) is gone, so
//   no select can be smaller than a thumb.
// - Full width (w-full on the wrapper), like every other field; a caller can
//   still narrow it with className, which goes to the wrapper.
// - No grey fill inside .dark sections, and an invalid select keeps the full
//   --destructive border there (shadcn faded it to 50%, about 2.2:1 on black).
// - The chevron sits 12px in, matching the text's 12px padding (px-3).
import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-10 pl-3 type-body transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
