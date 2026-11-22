import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { formatRegistration } from "@/domain/registration";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import type { EstimateRequestRow } from "@/server/dal/estimate-requests";

/** Characters of the description a card shows: about two lines on a phone. */
export const DESCRIPTION_PREVIEW_LENGTH = 120;

/** The start of a description, on one line, cut at a word with "…" when it's longer. */
export function descriptionPreview(description: string, max = DESCRIPTION_PREVIEW_LENGTH): string {
  const oneLine = description.replace(/\s+/g, " ").trim();
  const characters = [...oneLine];
  if (characters.length <= max) return oneLine;
  const cut = characters.slice(0, max).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type EstimateRequestsProps = {
  /** The customer's requests, newest first (listMyEstimateRequests()). */
  requests: EstimateRequestRow[];
  locale: Locale;
};

/**
 * "Your estimate requests" on /account (task 32): a link to /estimate, and
 * each request the customer sent, newest first: when, for which vehicle,
 * the start of what they wrote, how many photos, and "Waiting for the
 * garage" (every request waits until task 51 lets the garage answer it). With
 * none yet, one line and the link.
 */
export async function EstimateRequests({ requests, locale }: EstimateRequestsProps) {
  const t = await getTranslations({ locale, namespace: "MyEstimates" });
  const tVehicles = await getTranslations({ locale, namespace: "Vehicles" });

  return (
    <section aria-labelledby="my-estimate-requests" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="my-estimate-requests" className="type-title">
          {t("heading")}
        </h2>
        {/* Grey: the vehicles' "Add a vehicle" is the page's blue button. */}
        <Button asChild variant="secondary">
          <Link href="/estimate">{t("requestLink")}</Link>
        </Button>
      </div>
      {requests.length === 0 ? (
        <p className="type-body text-pretty text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-1">
                <h3 className="type-body font-semibold">
                  {localize(request.makeName, locale)} {localize(request.modelName, locale)}
                </h3>
                <p className="flex flex-wrap gap-x-4 type-callout text-muted-foreground">
                  <span>{tVehicles(`fuels.${request.fuel}`)}</span>
                  {request.registrationNumber && (
                    <span className="whitespace-nowrap tabular-nums">{formatRegistration(request.registrationNumber)}</span>
                  )}
                  <span>{t("sentOn", { date: formatDate(request.createdAt, locale) })}</span>
                </p>
              </div>
              <p className="type-body text-pretty break-words">{descriptionPreview(request.description)}</p>
              <p className="flex flex-wrap gap-x-4 type-callout">
                <span className="font-semibold">{t("waiting")}</span>
                <span className="text-muted-foreground">{t("photos", { count: request.photoCount })}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
