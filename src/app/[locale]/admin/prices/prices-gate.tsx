import { PriceList } from "@/components/admin/price-list";
import type { Locale } from "@/i18n/config";
import { requirePermission } from "@/server/auth/access";
import { listPricesForStaff, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

/**
 * The part of /admin/prices that waits for the request (task 39): the
 * access check first (content.edit: manager, owner), so a customer gets the
 * 404 page and no staff word reaches them; then the live prices.
 */
export async function PricesGate({ locale }: { locale: Locale }) {
  await requirePermission(locale, "content.edit");
  const [services, prices, catalogue] = await Promise.all([readServices(), listPricesForStaff(), readVehicleCatalogue()]);
  return <PriceList locale={locale} services={services} prices={prices} catalogue={catalogue} />;
}
