import { io } from "next/cache";

import { BookingWizard, type BookingWizardAccount, type BookingWizardProps } from "@/components/booking/booking-wizard";
import { needsName } from "@/domain/profile";
import { serializeSlotDays } from "@/lib/booking-form";
import { formatPhoneNumber } from "@/lib/contact-links";
import { getCurrentUser } from "@/server/auth/session";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";
import { readAvailableSlots } from "@/server/dal/slots";

/** Everything the wizard needs that the page reads ahead of time; the loader adds the rest. */
export type BookingLoaderProps = Omit<BookingWizardProps, "account" | "slots">;

/**
 * The part of /book that waits for the request: who is logged in (with
 * their saved vehicles) and the live slot list. The page puts it inside
 * <Suspense>, so everything around it is still built ahead of time.
 *
 * `await io()` comes first: it tells Next.js that what follows must be read
 * fresh for each visitor, never captured in the prebuilt page. The slots read
 * the clock, and a slot list frozen at build time would offer times that
 * have already gone (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/io.md).
 */
export async function BookingLoader(props: BookingLoaderProps) {
  await io();
  // Two independent reads, started together.
  const [account, days] = await Promise.all([readAccount(), readAvailableSlots()]);
  // Dates become ISO strings: a client component's props must be plain values.
  return <BookingWizard {...props} account={account} slots={serializeSlotDays(days)} />;
}

/** Who is logged in, with their saved vehicles and whether a name is still missing, or null. */
async function readAccount(): Promise<BookingWizardAccount | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  // Both read the logged-in user's own rows (authorizeUser inside each).
  const [profile, vehicles] = await Promise.all([readMyProfile(), listMyVehicles()]);
  return {
    // Written as /account shows it: "+91 98765 43210".
    phoneDisplay: formatPhoneNumber(user.phoneNumber),
    vehicles,
    needsName: needsName(profile),
  };
}
