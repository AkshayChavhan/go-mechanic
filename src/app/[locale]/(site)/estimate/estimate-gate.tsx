import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { EstimateForm, type EstimateFormProps } from "@/components/estimate/estimate-form";
import { Button } from "@/components/ui/button";
import { formatRegistration } from "@/domain/registration";
import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH, LOGIN_PATH } from "@/lib/access-routes";
import { getCurrentUser } from "@/server/auth/session";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";

/** Everything the form needs that the page can build ahead of time. */
export type EstimateGateProps = { locale: Locale } & Omit<EstimateFormProps, "savedVehicles">;

/**
 * Who may ask for an estimate, and the form for them (task 32):
 * - logged out: a line and a link to log in;
 * - logged in with no name yet: a link to /account, where the name form is;
 * - otherwise the form, with the customer's saved vehicles to choose from.
 *
 * It reads the session cookie, so /estimate puts it inside <Suspense>: the
 * rest of the page is still built ahead of time. The sendEstimateRequest
 * action checks the login and the name again before saving, so a form
 * posted directly can't skip this.
 */
export async function EstimateGate({ locale, ...formProps }: EstimateGateProps) {
  const t = await getTranslations({ locale, namespace: "EstimatePage" });
  const user = await getCurrentUser();
  if (!user) {
    return (
      <GateNote note={t("loginNote")}>
        <Button asChild className="w-full sm:w-fit">
          <Link href={LOGIN_PATH}>{t("loginLink")}</Link>
        </Button>
      </GateNote>
    );
  }
  if (needsName(await readMyProfile())) {
    return (
      <GateNote note={t("nameNote")}>
        <Button asChild className="w-full sm:w-fit">
          <Link href={ACCOUNT_PATH}>{t("nameLink")}</Link>
        </Button>
      </GateNote>
    );
  }

  const vehicles = await listMyVehicles();
  const savedVehicles = vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: `${localize(vehicle.makeName, locale)} ${localize(vehicle.modelName, locale)} · ${formatRegistration(vehicle.registrationNumber)}`,
  }));
  // Nothing to choose from: no saved vehicle, and no catalogue to pick from.
  if (savedVehicles.length === 0 && formProps.catalogue.makes.length === 0) {
    return <p className="type-body text-pretty">{t("noCatalogue")}</p>;
  }
  // Keyed by the user: on a shared phone, the next customer to log in never
  // sees what the last one typed or uploaded.
  return <EstimateForm key={user.id} savedVehicles={savedVehicles} {...formProps} />;
}

function GateNote({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="type-body text-pretty">{note}</p>
      {children}
    </div>
  );
}
