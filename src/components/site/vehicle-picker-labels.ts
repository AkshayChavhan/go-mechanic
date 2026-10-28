import { getTranslations } from "next-intl/server";

import type { VehiclePickerLabels } from "./vehicle-picker";

/**
 * The vehicle picker's words, from the Vehicles messages, for a server page
 * to pass to <VehiclePicker labels={...}>. The picker is a client island and
 * reads no messages itself, so the Vehicles namespace never has to reach the
 * browser. Templates are read raw: the picker fills in their {placeholders}.
 */
export async function vehiclePickerLabels(): Promise<VehiclePickerLabels> {
  const t = await getTranslations("Vehicles");
  return {
    kindLegend: t("picker.kindLegend"),
    kinds: { car: t("kinds.car"), "two-wheeler": t("kinds.twoWheeler") },
    makeLabel: t("picker.makeLabel"),
    makePlaceholder: t("picker.makePlaceholder"),
    makeGroups: { car: t("picker.makeGroups.car"), "two-wheeler": t("picker.makeGroups.twoWheeler") },
    modelLabel: t("picker.modelLabel"),
    modelPlaceholder: t("picker.modelPlaceholder"),
    modelGroup: t.raw("picker.modelGroup") as string,
    fuelLegend: t("picker.fuelLegend"),
    fuels: {
      petrol: t("fuels.petrol"),
      diesel: t("fuels.diesel"),
      cng: t("fuels.cng"),
      electric: t("fuels.electric"),
    },
    announceSet: t.raw("picker.announceSet") as string,
    announceCleared: t.raw("picker.announceCleared") as string,
  };
}
