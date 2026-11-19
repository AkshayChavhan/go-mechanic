import { useLocale, useTranslations } from "next-intl";

import { SampleBadge } from "@/components/site/sample-badge";
import { Section } from "@/components/site/section";
import type { Garage } from "@/domain/garage";
import type { PickupArea } from "@/domain/pickup";
import { formatRupees } from "@/i18n/format";
import type { Shown } from "@/lib/samples";

import type { Tone } from "../../_components/home-tones";
import { contactRichText } from "../../_components/contact-rich-text";

// /contact's "Pickup and drop" section (task 24): the PIN codes the garage
// collects vehicles from, each with its one fee for pickup and drop together.
// The page renders it only when selectPickupAreas() returns something: real
// areas in every build, samples (one Sample badge, data-sample) under
// `npm run dev` only. Nothing here reads the database or the time, so the
// page stays built ahead of time.

type Props = {
  shown: Shown<PickupArea>;
  tone: Tone;
  garage: Pick<Garage, "phone" | "whatsapp">;
  /** The WhatsApp chat's opening text (Contact.whatsappMessage). */
  whatsappMessage: string;
};

export function PickupAreas({ shown, tone, garage, whatsappMessage }: Props) {
  const t = useTranslations("PickupAreas");
  const locale = useLocale();
  const { call, whatsapp } = contactRichText(garage, whatsappMessage);

  return (
    <Section
      tone={tone}
      width="wide"
      aria-labelledby="contact-pickup"
      data-sample={shown.sample ? "pickup-areas" : undefined}
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 id="contact-pickup" className="flex flex-wrap items-center gap-3 type-title">
            {t("title")}
            {shown.sample && <SampleBadge />}
          </h2>
          <p className="type-body text-pretty">{t("lead")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full type-callout">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-4 text-left font-normal">
                  {t("postalCodeHeader")}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t("feeHeader")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.items.map((area) => (
                <tr key={area.postalCode} className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal tabular-nums">
                    {area.postalCode}
                  </th>
                  <td className="py-3 text-right font-semibold tabular-nums">
                    {area.feePaise === 0 ? t("free") : formatRupees(area.feePaise, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="type-body text-pretty">{t.rich("notListed", { call, whatsapp })}</p>
      </div>
    </Section>
  );
}
