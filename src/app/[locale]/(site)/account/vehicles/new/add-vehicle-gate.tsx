import { RedirectType } from "next/navigation";

import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import { requireUser } from "@/server/auth/access";
import { readMyProfile } from "@/server/dal/profile";

/**
 * Who may add a vehicle: a logged-in customer who has given their name.
 * Draws nothing. Logged out: to /login?session=ended (requireUser). No name
 * yet: to /account, where the name form is.
 *
 * It reads the session cookie, so it sits inside <Suspense>: the form around
 * it is still built ahead of time. By the time it runs the page has started
 * streaming, so its redirect happens in the browser. The addVehicle action
 * checks both again before saving, so a form posted directly can't skip it.
 */
export async function AddVehicleGate({ locale }: { locale: Locale }) {
  await requireUser(locale);
  if (needsName(await readMyProfile())) redirect({ href: ACCOUNT_PATH, locale }, RedirectType.replace);
  return null;
}
