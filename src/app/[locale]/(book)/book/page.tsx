import { PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { Section } from "@/components/site/section";
import { vehiclePickerLabels } from "@/components/site/vehicle-picker-labels";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { bookingLoginStep, confirmBooking, notMe } from "@/server/actions/booking";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { BookingLoader } from "./booking-loader";

// /book: book a service in four steps (task 47). Inside the (book) group, so
// it gets the shell without the phone action bar: the wizard's own buttons
// sit at the bottom of a phone instead.
//
// Built ahead of time: the heading, the intro and the no-JavaScript note,
// plus everything the wizard needs that is the same for every visitor (the
// catalogue, the services, the real prices, the garage's phone), all from
// cached reads. Only <BookingLoader> waits for the request, inside
// <Suspense>: it reads the session and the live slots.
//
// The wizard needs JavaScript (a product decision: a form that posts without
// it was about twice the work). Without it, <noscript> says so and offers the
// phone and WhatsApp.

// Static: reads no session. Indexable, unlike /account: anyone may book.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Booking");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }) };
}

// Async because it reads the catalogue, services, prices and garage from the
// database. All four reads are cached, so the page is still built ahead of time.
export default async function BookPage() {
  const locale = await getLocale();
  const t = await getTranslations("Booking");
  const tLogin = await getTranslations("Login");
  const tBrand = await getTranslations("Brand");
  const tContact = await getTranslations("Contact");
  // The wizard's words as one object, templates with their {placeholders}
  // left in: the wizard fills them in itself (booking-labels.ts).
  const wizardLabels = (await getMessages()).Booking.wizard;
  const [catalogue, services, prices, garage, pickerLabels] = await Promise.all([
    readVehicleCatalogue(),
    readServices(),
    // The real prices only, never the samples `npm run dev` shows elsewhere
    // (selectPrices): a made-up price must never reach a booking.
    readServicePrices(),
    readGarage(),
    vehiclePickerLabels(),
  ]);

  // The way out when the wizard can't help (no JavaScript, nothing offered,
  // a refused booking): the garage's Call and WhatsApp buttons. WhatsApp
  // opens with the booking message typed in.
  const contactLinks = (
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="secondary">
        <a href={telHref(garage.phone)}>
          <PhoneIcon data-icon="inline-start" />
          {tContact("call")}
        </a>
      </Button>
      <Button asChild variant="secondary">
        <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("bookingMessage"))}>
          {tContact("whatsapp")}
        </WhatsAppLink>
      </Button>
    </div>
  );

  // The login step's words, as /login builds them (keep the two in step).
  // The privacy notice opens in a new tab, so the choices made so far aren't lost.
  const privacy = (chunks: ReactNode) => (
    <Link href="/privacy" target="_blank" rel="noopener" className="text-link underline underline-offset-4">
      {chunks}
      <span className="sr-only"> {tLogin("opensInNewTab")}</span>
    </Link>
  );
  const loginLabels = {
    phoneLabel: tLogin("phoneLabel"),
    countryCode: tLogin("countryCode"),
    phoneHint: tLogin("phoneHint"),
    ageLabel: tLogin("ageLabel"),
    consentLabel: tLogin("consentLabel", { brand: tBrand("name") }),
    notice: tLogin.rich("notice", { privacy }),
    sendCode: tLogin("sendCode"),
    sending: tLogin("sending"),
    codeLabel: tLogin("codeLabel"),
    logIn: tLogin("logIn"),
    checking: tLogin("checking"),
    resend: tLogin("resend"),
    // Raw templates: the browser fills in {time} as it counts down.
    resendIn: tLogin.raw("resendIn") as string,
    resendReady: tLogin("resendReady"),
    waitFor: tLogin.raw("waitFor") as string,
    changeNumber: tLogin("changeNumber"),
    connection: tLogin("errors.connection"),
  };

  return (
    // wide: the left edge lines up with the header's Wordmark.
    <Section width="wide">
      <div className="flex max-w-2xl flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("intro")}</p>
        </div>
        <noscript>
          <div className="flex flex-col gap-4">
            <p className="type-body text-pretty">{t("noScript")}</p>
            {contactLinks}
          </div>
        </noscript>
        {/* The fallback holds about the first step's height (657 to 684 px,
            measured), so the footer doesn't jump when the wizard streams in. */}
        <Suspense fallback={<p className="min-h-168 type-callout text-muted-foreground">{t("loading")}</p>}>
          <BookingLoader
            // The locale goes in as each action's first argument: a Server
            // Action has no [locale] page around it to read it from.
            loginAction={bookingLoginStep.bind(null, locale)}
            confirmAction={confirmBooking.bind(null, locale)}
            notMeAction={notMe.bind(null, locale)}
            catalogue={catalogue}
            services={services}
            prices={prices}
            labels={wizardLabels}
            loginLabels={loginLabels}
            pickerLabels={pickerLabels}
            contactLinks={contactLinks}
          />
        </Suspense>
      </div>
    </Section>
  );
}
