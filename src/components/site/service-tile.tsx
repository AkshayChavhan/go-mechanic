import {
  BatteryChargingIcon,
  CircleDotIcon,
  CogIcon,
  Disc3Icon,
  EngineIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
  SparklesIcon,
  SprayCanIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Service, ServiceId, VehicleKind } from "@/content/services";
import { localize } from "@/i18n/localized-text";
import { cn } from "@/lib/utils";

// One icon per service. A Record over every ServiceId: adding a service to
// src/content/services.ts without an icon here fails `npm run typecheck`.
const icons: Record<ServiceId, LucideIcon> = {
  "periodic-service": WrenchIcon,
  ac: SnowflakeIcon,
  "denting-painting": SprayCanIcon,
  battery: BatteryChargingIcon,
  "tyres-alignment": CircleDotIcon,
  brakes: Disc3Icon,
  "clutch-suspension": CogIcon,
  engine: EngineIcon,
  electricals: ZapIcon,
  "wash-detailing": SparklesIcon,
  "insurance-claim-help": ShieldCheckIcon,
};

/**
 * The service's icon; a wrench for a service added later without one (task 18
 * reads them from the database). A component, so the icon is picked from the
 * fixed list above rather than made while the tile renders.
 */
function ServiceIcon({ id, className }: { id: string; className?: string }) {
  const Icon = Object.hasOwn(icons, id) ? icons[id as ServiceId] : WrenchIcon;
  return <Icon aria-hidden="true" className={className} />;
}

/** Which "vehicles" message describes the kinds a service covers. */
function vehiclesKey(vehicles: readonly VehicleKind[]): "both" | "car" | "twoWheeler" {
  const car = vehicles.includes("car");
  const twoWheeler = vehicles.includes("two-wheeler");
  if (car && twoWheeler) return "both";
  return car ? "car" : "twoWheeler";
}

/**
 * One service in the home page's grid: its icon, name, a one-line summary and
 * which vehicles it's for. A flat tile, and not a link: there are no service
 * pages or prices yet (task 18 adds both), so it has no hover effect either.
 * The heading is an h3, under the section's h2.
 */
export function ServiceTile({ service, className }: { service: Service; className?: string }) {
  const t = useTranslations("HomePage.services.vehicles");
  const locale = useLocale();

  return (
    // --card-spacing: 24px of padding, roomier than shadcn's 16px default.
    <Card className={cn("h-full [--card-spacing:--spacing(6)]", className)}>
      <CardHeader className="gap-2">
        <ServiceIcon id={service.id} className="mb-2 size-7" />
        <CardTitle>
          <h3>{localize(service.name, locale)}</h3>
        </CardTitle>
        <CardDescription>{localize(service.summary, locale)}</CardDescription>
      </CardHeader>
      {/* mt-auto: the vehicles line sits at the bottom of every tile in a row. */}
      <CardContent className="mt-auto">
        <p className="type-caption text-muted-foreground">{t(vehiclesKey(service.vehicles))}</p>
      </CardContent>
    </Card>
  );
}
