import { useTranslations } from "next-intl";

/**
 * What every staff page shows while its gate checks who is asking (task 26):
 * one neutral line, the <Suspense> fallback. It's part of the page built
 * ahead of time, which anyone can receive, so it says nothing about staff
 * work: every staff word renders inside the gate, after the access check.
 */
export function AdminLoading() {
  const t = useTranslations("Admin");
  return <p className="type-body text-muted-foreground">{t("loading")}</p>;
}
