import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { isExpired } from "@/domain/customer-vehicles";
import type { IndiaDate } from "@/domain/india-time";
import { formatRegistration } from "@/domain/registration";
import type { Locale } from "@/i18n/config";
import { formatIndiaDate } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import type { MyVehicle } from "@/server/dal/customer-vehicles";

type VehicleListProps = {
  /** The customer's vehicles, oldest first (listMyVehicles()). */
  vehicles: MyVehicle[];
  /** India's today: a date before it shows "Expired". */
  today: IndiaDate;
  locale: Locale;
};

/**
 * The customer's vehicles on /account (task 21): brand and model, fuel,
 * the registration number as people read it ("MH 12 AB 1234"), and the PUC
 * and insurance dates, with "Expired" next to a date that has passed.
 * Electric vehicles have no PUC line: they need no PUC certificate.
 */
export async function VehicleList({ vehicles, today, locale }: VehicleListProps) {
  const t = await getTranslations({ locale, namespace: "MyVehicles" });
  const tVehicles = await getTranslations({ locale, namespace: "Vehicles" });

  if (vehicles.length === 0) {
    return <p className="type-body text-muted-foreground">{t("empty")}</p>;
  }

  /** One date line: valid until a date (maybe "Expired"), or not added. */
  function expiryLine(date: IndiaDate | null, until: "pucUntil" | "insuranceUntil", missing: "pucMissing" | "insuranceMissing") {
    if (date === null) return <li className="text-muted-foreground">{t(missing)}</li>;
    return (
      <li className="flex flex-wrap items-center gap-2">
        {t(until, { date: formatIndiaDate(date, locale) })}
        {isExpired(date, today) && <Badge variant="destructive">{t("expired")}</Badge>}
      </li>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {vehicles.map((vehicle) => (
        <li key={vehicle.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h3 className="type-body font-semibold">
              {localize(vehicle.makeName, locale)} {localize(vehicle.modelName, locale)}
            </h3>
            <p className="flex flex-wrap gap-x-4 type-callout text-muted-foreground">
              <span>{tVehicles(`fuels.${vehicle.fuel}`)}</span>
              <span className="whitespace-nowrap tabular-nums">{formatRegistration(vehicle.registrationNumber)}</span>
            </p>
          </div>
          <ul className="flex flex-col gap-1 type-callout">
            {vehicle.fuel !== "electric" && expiryLine(vehicle.pucExpiresOn, "pucUntil", "pucMissing")}
            {expiryLine(vehicle.insuranceExpiresOn, "insuranceUntil", "insuranceMissing")}
          </ul>
        </li>
      ))}
    </ul>
  );
}
