import { ArrowLeftIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VehicleForm } from "@/components/account/vehicle-form";
import { Section } from "@/components/site/section";
import { vehiclePickerLabels } from "@/components/site/vehicle-picker-labels";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { addVehicle } from "@/server/actions/account";
import { readGarage } from "@/server/dal/garage";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { AddVehicleGate } from "./add-vehicle-gate";

// /account/vehicles/new: add a vehicle to the account (task 21).
//
// Built ahead of time: the form, fed by the cached catalogue and garage
// reads. Only <AddVehicleGate> waits for the request, inside <Suspense>,
// because it reads the session. The proxy already sends a visitor with no
// session cookie to /login with a real 307 (everything under /account).
// Without JavaScript the form still posts: the action checks the login and
// the name itself.

// Static: reads no session. noindex: a personal page, nothing to list.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MyVehicles");
  const tBrand = await getTranslations("Brand");
  return {
    title: t("metaTitle", { brand: tBrand("name") }),
    robots: { index: false, follow: false },
  };
}

// Async because it reads the catalogue and the garage's phone from the
// database. Both reads are cached, so the page is still built ahead of time.
export default async function AddVehiclePage() {
  const locale = await getLocale();
  const t = await getTranslations("MyVehicles");
  const tContact = await getTranslations("Contact");
  const tLogin = await getTranslations("Login");
  const [catalogue, pickerLabels, garage] = await Promise.all([
    readVehicleCatalogue(),
    vehiclePickerLabels(),
    readGarage(),
  ]);
  const hasCatalogue = catalogue.makes.length > 0;

  return (
    // wide: the left edge lines up with the header's Wordmark.
    <Section width="wide">
      <div className="flex max-w-md flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Button asChild variant="link" className="-ml-3 w-fit">
            <Link href={ACCOUNT_PATH}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t("backLink")}
            </Link>
          </Button>
          <h1 className="type-headline text-balance">{t("formHeading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("formNote")}</p>
        </div>

        {hasCatalogue && (
          <VehicleForm
            // The locale goes in as the action's first argument: a Server
            // Action has no [locale] page around it to read it from.
            action={addVehicle.bind(null, locale)}
            catalogue={catalogue}
            pickerLabels={pickerLabels}
            labels={{
              registrationLabel: t("registrationLabel"),
              registrationHint: t("registrationHint"),
              pucLabel: t("pucLabel"),
              insuranceLabel: t("insuranceLabel"),
              submit: t("submit"),
              saving: t("saving"),
              connection: tLogin("errors.connection"),
            }}
          />
        )}

        {/* The way out for a vehicle the picker doesn't list, or a plate the
            form refuses: the garage's phone and WhatsApp. */}
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <p className="type-callout text-pretty text-muted-foreground">
            {hasCatalogue ? t("notListed") : t("noCatalogue")}
          </p>
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
      <Suspense fallback={null}>
        <AddVehicleGate locale={locale} />
      </Suspense>
    </Section>
  );
}
