import {
  ArrowRightIcon,
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
import type { Service } from "@/domain/services";
import type { VehicleKind } from "@/domain/vehicles";
import { formatRupees } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { SampleBadge } from "./sample-badge";

// One icon per seeded service (service-tile.test.tsx checks each has its
// own). A service the owner adds later (task 39) gets the wrench.
const icons: Partial<Record<string, LucideIcon>> = {
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
 * The service's icon; a wrench for a service without one. A component, so the
 * icon is picked from the fixed list above rather than made while the tile
 * renders.
 */
function ServiceIcon({ id, className }: { id: string; className?: string }) {
  const Icon = (Object.hasOwn(icons, id) ? icons[id] : undefined) ?? WrenchIcon;
  return <Icon aria-hidden="true" className={className} />;
}

/** Which "vehicles" message (HomePage.services.vehicles) describes the kinds a service covers. */
export function vehiclesKey(vehicles: readonly VehicleKind[]): "both" | "car" | "twoWheeler" {
  const car = vehicles.includes("car");
  const twoWheeler = vehicles.includes("two-wheeler");
  if (car && twoWheeler) return "both";
  return car ? "car" : "twoWheeler";
}

type ServiceTileProps = {
  service: Service;
  /** The service's page. With it, the whole tile is a link (task 18). */
  href?: string;
  /** The lowest price, in paise, shown as "From ₹…" (fromPrice()). */
  fromPaise?: number | null;
  /** The price is a sample (selectPrices()): marked with data-sample and the Sample badge. */
  sample?: boolean;
  className?: string;
};

/**
 * One service in a grid: its icon, name, a one-line summary and which
 * vehicles it's for, plus "From ₹…" when there's a price. The heading is an
 * h3, under the section's h2.
 *
 * With `href`, the tile is a link: the link sits on the name, and its ::after
 * stretches over the whole tile, so the tile is one large target (well over
 * 44px) that screen readers hear as the service's name. The tile shows the
 * hover and the focus ring, since the link's own box is only the name.
 */
export function ServiceTile({ service, href, fromPaise, sample = false, className }: ServiceTileProps) {
  const t = useTranslations("HomePage.services.vehicles");
  const tServices = useTranslations("Services");
  const locale = useLocale();
  const name = localize(service.name, locale);

  return (
    // --card-spacing: 24px of padding, roomier than shadcn's 16px default.
    <Card
      className={cn(
        "h-full [--card-spacing:--spacing(6)]",
        href &&
          "relative transition-colors has-[a:hover]:bg-muted has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring",
        className,
      )}
    >
      <CardHeader className="gap-2">
        <ServiceIcon id={service.id} className="mb-2 size-7" />
        <CardTitle>
          <h3>
            {href ? (
              <Link href={href} className="outline-none after:absolute after:inset-0">
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
        </CardTitle>
        <CardDescription>{localize(service.summary, locale)}</CardDescription>
      </CardHeader>
      {/* mt-auto: the bottom line sits at the bottom of every tile in a row. */}
      <CardContent className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="type-caption text-muted-foreground">{t(vehiclesKey(service.vehicleKinds))}</p>
        {fromPaise != null && (
          <p
            data-sample={sample ? "service-price" : undefined}
            className="flex items-center gap-2 type-caption font-semibold"
          >
            {tServices("from", { price: formatRupees(fromPaise, locale) })}
            {sample && <SampleBadge />}
          </p>
        )}
        {href && <ArrowRightIcon aria-hidden="true" className="ml-auto size-5 text-link" />}
      </CardContent>
    </Card>
  );
}
