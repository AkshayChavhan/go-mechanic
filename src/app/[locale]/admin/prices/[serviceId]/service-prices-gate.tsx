import { notFound } from "next/navigation";

import { ServicePriceEditor } from "@/components/admin/service-price-editor";
import type { Locale } from "@/i18n/config";
import { requirePermission } from "@/server/auth/access";
import { listPricesForStaff, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

type ServicePricesGateProps = {
  locale: Locale;
  /** The page's params, still a promise: only this part waits for the request. */
  params: Promise<{ serviceId: string }>;
};

/**
 * The part of /admin/prices/[serviceId] that waits for the request (task 39).
 * The access check comes first (content.edit), so a customer gets the 404
 * page whatever the id. Then an unknown or hidden id (a service or a
 * package) is the 404 too.
 */
export async function ServicePricesGate({ locale, params }: ServicePricesGateProps) {
  await requirePermission(locale, "content.edit");
  const { serviceId } = await params;
  const [services, prices, catalogue] = await Promise.all([readServices(), listPricesForStaff(), readVehicleCatalogue()]);
  const service = services.find((row) => row.id === serviceId);
  if (!service) notFound();
  return <ServicePriceEditor locale={locale} service={service} prices={prices} catalogue={catalogue} />;
}
