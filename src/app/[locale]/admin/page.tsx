import { useLocale } from "next-intl";
import { Suspense } from "react";

import { AdminLoading } from "@/components/admin/admin-loading";
import { AdminOverview } from "@/components/admin/admin-overview";
import { Section } from "@/components/site/section";

// /admin: the staff area's front page (task 26). Built ahead of time with
// only the loading line; AdminOverview checks the login and admin.open
// inside <Suspense>, then shows a card for each section this person may
// open. No metadata of its own: the layout's title is the brand alone.
export default function AdminPage() {
  const locale = useLocale();
  return (
    // wide: the left edge lines up with the bar's Wordmark.
    <Section width="wide">
      <Suspense fallback={<AdminLoading />}>
        <AdminOverview locale={locale} />
      </Suspense>
    </Section>
  );
}
