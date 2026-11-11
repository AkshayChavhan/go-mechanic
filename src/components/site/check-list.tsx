import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A list of what's included, each line with a tick. Plain props and no
 * hooks, so server pages and client islands can both use it.
 */
export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 type-callout">
          {/* mt-0.5: the tick sits on the first line of a wrapped item. */}
          <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
