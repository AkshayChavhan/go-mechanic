import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * The brand name as a logo. The one place code shows the name (it comes from
 * messages/en.json, Brand.name), so a rename changes it everywhere.
 *
 * - Always Inter (font-brand), never San Francisco: a logo must look the same
 *   on every device. Semibold, with tighter letter-spacing than body text.
 * - Size comes from className: <Wordmark className="type-title" />. Its own
 *   weight and letter-spacing still win, because Tailwind puts them after the
 *   type-* classes in the CSS.
 * - translate="no": Chrome offers Indian visitors automatic translation into
 *   Hindi, which would otherwise translate the name.
 * - A plain <span>: wrap it in a link or a heading where the page needs one.
 */
export function Wordmark({ className }: { className?: string }) {
  const t = useTranslations("Brand");
  return (
    <span translate="no" className={cn("font-brand font-semibold tracking-[-0.025em]", className)}>
      {t("name")}
    </span>
  );
}
