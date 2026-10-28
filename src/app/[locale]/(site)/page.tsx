import { getTranslations } from "next-intl/server";

import { bookTarget } from "@/components/site/navigation";
import { ScrollScene } from "@/components/site/scroll-scene";
import { selectReviews, selectTrustStats } from "@/content/home";
import { services } from "@/content/services";
import { whatsappHref } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { HomeCta } from "./_components/home-cta";
import { HomeHero } from "./_components/home-hero";
import { HomeReviews } from "./_components/home-reviews";
import { HomeServices } from "./_components/home-services";
import { HomeStats } from "./_components/home-stats";
import { HomeStory } from "./_components/home-story";
import { homeTones } from "./_components/home-tones";

// The whole home page must be built ahead of time, so it loads fast on 4G
// (plan KTD10). If this page, or a layout above it, ever reads something per
// request (cookies, headers, an uncached database call), `next dev` and
// `next build` fail with "encountered uncached or runtime data on a route
// that must be fully static" instead of quietly making it slower.
export const ensureStatic = "navigation";

/**
 * The home page: hero, how a visit works, services, then trust stats and
 * reviews when there's something to show, and a final call to action.
 *
 * Everything renders on the server. ScrollScene, the one client island, adds
 * the scroll motion in the browser, for visitors who allow it. No <main>
 * here: the shell around every public page ((site)/layout.tsx) provides it.
 *
 * Async because it reads the garage and the vehicle brands from the database
 * (both reads are cached, so the page is still built ahead of time). An async component
 * reads its text with getTranslations instead of useTranslations.
 */
export default async function Home() {
  const tContact = await getTranslations("Contact");

  // The garage is read the way the shell and the 404 pages read it.
  const garage = await readGarage();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));

  // The brands the garage works on, for the row under the services (cached
  // too). Only their names go to the section, not the models.
  const catalogue = await readVehicleCatalogue();
  const brands = catalogue.makes.map(({ id, kind, name }) => ({ id, kind, name }));

  // Real data, else samples under `npm run dev`, else null (src/content/home.ts).
  const stats = selectTrustStats();
  const reviews = selectReviews();
  const tones = homeTones({ stats: stats !== null, reviews: reviews !== null });

  return (
    <ScrollScene>
      <HomeHero book={book} phone={garage.phone} />
      <HomeStory />
      <HomeServices services={services} brands={brands} />
      {stats && <HomeStats stats={stats} tone={tones.stats} />}
      {reviews && <HomeReviews reviews={reviews} tone={tones.reviews} />}
      <HomeCta book={book} phone={garage.phone} tone={tones.cta} />
    </ScrollScene>
  );
}
