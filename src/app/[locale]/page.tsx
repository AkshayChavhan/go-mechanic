import { useTranslations } from "next-intl";

// Placeholder home page. Task 13 builds the real one.
// All text comes from messages/en.json (namespace "HomePage").
export default function Home() {
  const t = useTranslations("HomePage");
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("tagline")}</p>
    </main>
  );
}
