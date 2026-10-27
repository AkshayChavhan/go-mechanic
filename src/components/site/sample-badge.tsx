import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

/**
 * The "Sample" mark on made-up content (trust stats and reviews), which only
 * `npm run dev` shows (src/lib/samples.ts). It tells the owner, while judging
 * the design, which numbers and words are invented.
 */
export function SampleBadge() {
  const t = useTranslations("HomePage");
  return <Badge variant="secondary">{t("sample")}</Badge>;
}
