import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { NameForm } from "@/components/account/name-form";
import { VehicleList } from "@/components/account/vehicle-list";
import { Button } from "@/components/ui/button";
import { indiaDateOf } from "@/domain/india-time";
import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { systemClock } from "@/lib/clock";
import { saveName } from "@/server/actions/account";
import { requireUser } from "@/server/auth/access";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";

/**
 * The main part of /account (task 21): the name form, until the customer
 * has given their name, then a hello by name, their vehicles and "Add a
 * vehicle".
 *
 * An async Server Component that reads the session, so /account puts it
 * inside <Suspense>, below Log out: it streams in under the parts already
 * shown, so nothing on screen moves when it arrives. Its reads happen at
 * request time, never while the page is built.
 */
export async function AccountContent({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  const profile = await readMyProfile();
  const tAccount = await getTranslations({ locale, namespace: "Account" });

  if (needsName(profile)) {
    const tLogin = await getTranslations({ locale, namespace: "Login" });
    return (
      // Keyed by the user: on a shared phone, the next customer to log in
      // never sees what the last one typed.
      <NameForm
        key={user.id}
        // The locale goes in as the action's first argument: a Server
        // Action has no [locale] page around it to read it from.
        action={saveName.bind(null, locale)}
        labels={{
          heading: tAccount("nameHeading"),
          note: tAccount("nameNote"),
          label: tAccount("nameLabel"),
          submit: tAccount("nameSubmit"),
          saving: tAccount("saving"),
          connection: tLogin("errors.connection"),
        }}
      />
    );
  }

  const t = await getTranslations({ locale, namespace: "MyVehicles" });
  const vehicles = await listMyVehicles();
  // India's today, for the "Expired" flags. Read after the session, so at
  // request time.
  const today = indiaDateOf(systemClock.now());

  return (
    <div className="flex flex-col gap-8">
      <p className="type-lead text-pretty">{tAccount("greeting", { name: profile.name })}</p>
      <section aria-labelledby="my-vehicles" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="my-vehicles" className="type-title">
            {t("listHeading")}
          </h2>
          <Button asChild>
            <Link href="/account/vehicles/new">
              <PlusIcon data-icon="inline-start" />
              {t("addLink")}
            </Link>
          </Button>
        </div>
        <VehicleList vehicles={vehicles} today={today} locale={locale} />
      </section>
    </div>
  );
}
