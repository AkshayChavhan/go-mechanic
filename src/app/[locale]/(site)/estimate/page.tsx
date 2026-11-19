import { PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { photoUploaderLabels } from "@/components/site/photo-uploader-labels";
import { Section } from "@/components/site/section";
import { vehiclePickerLabels } from "@/components/site/vehicle-picker-labels";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Button } from "@/components/ui/button";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { sendEstimateRequest } from "@/server/actions/estimates";
import { finishPhotos, startPhotos } from "@/server/actions/photos";
import { readGarage } from "@/server/dal/garage";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { EstimateGate } from "./estimate-gate";

// /estimate: ask the garage for a free estimate (task 32).
//
// A public page, built ahead of time: the heading, how it works, and the
// garage's phone and WhatsApp, fed by the cached catalogue and garage reads.
// Only <EstimateGate> waits for the request, inside <Suspense>, because it
// reads the session: a login link for a guest, a link to the name form, or
// the form itself. The form needs JavaScript, like the other account forms.

const STEPS = ["describe", "photos", "reply"] as const;

// Static: reads no session. Indexable: a page people may search for.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EstimatePage");
  const tBrand = await getTranslations("Brand");
  return {
    title: t("metaTitle", { brand: tBrand("name") }),
    description: t("metaDescription"),
  };
}

// Async because it reads the catalogue and the garage's phone from the
// database. Both reads are cached, so the page is still built ahead of time.
export default async function EstimatePage() {
  const locale = await getLocale();
  const t = await getTranslations("EstimatePage");
  const tContact = await getTranslations("Contact");
  const tLogin = await getTranslations("Login");
  const [catalogue, pickerLabels, photoLabels, garage] = await Promise.all([
    readVehicleCatalogue(),
    vehiclePickerLabels(),
    photoUploaderLabels(),
    readGarage(),
  ]);

  return (
    // wide: the left edge lines up with the header's Wordmark.
    <Section width="wide">
      <div className="flex max-w-xl flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>

        <section aria-labelledby="estimate-steps" className="flex flex-col gap-4">
          <h2 id="estimate-steps" className="type-title">
            {t("stepsHeading")}
          </h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted type-callout font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="type-body text-pretty">{t(`steps.${step}`)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* The loading line holds one line's height until the gate streams in. */}
        <Suspense fallback={<p className="type-body text-muted-foreground">{t("loading")}</p>}>
          <EstimateGate
            locale={locale}
            // The locale goes in as each action's first argument: a Server
            // Action has no [locale] page around it to read it from.
            action={sendEstimateRequest.bind(null, locale)}
            startPhotos={startPhotos.bind(null, locale)}
            finishPhotos={finishPhotos.bind(null, locale)}
            catalogue={catalogue}
            pickerLabels={pickerLabels}
            photoLabels={photoLabels}
            labels={{
              vehicleLegend: t("vehicleLegend"),
              otherVehicle: t("otherVehicle"),
              descriptionLabel: t("descriptionLabel"),
              descriptionHint: t("descriptionHint"),
              descriptionCount: t.raw("descriptionCount") as string,
              photosLegend: t("photosLegend"),
              photosHint: t("photosHint"),
              submit: t("submit"),
              sending: t("sending"),
              waitingForPhotos: t("waitingForPhotos"),
              connection: tLogin("errors.connection"),
            }}
          />
        </Suspense>

        {/* The way out for anyone who'd rather talk: the garage's phone and WhatsApp. */}
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <p className="type-callout text-pretty text-muted-foreground">{t("talkNote")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href={telHref(garage.phone)}>
                <PhoneIcon data-icon="inline-start" />
                {tContact("call")}
              </a>
            </Button>
            <Button asChild variant="secondary">
              <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}>
                {tContact("whatsapp")}
              </WhatsAppLink>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
