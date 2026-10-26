import { useTranslations } from "next-intl";

import { Section } from "@/components/site/section";

// Placeholder home page. Task 13 builds the real one.
// All text comes from messages/en.json (namespace "HomePage").
// No <main> here: the shell around every public page ((site)/layout.tsx)
// already provides it, and a page must have only one.
export default function Home() {
  const t = useTranslations("HomePage");
  return (
    <Section>
      <div className="flex flex-col gap-4">
        <h1 className="type-display text-balance">{t("title")}</h1>
        <p className="type-lead text-muted-foreground">{t("tagline")}</p>
      </div>
    </Section>
  );
}
