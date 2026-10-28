import { LoaderCircleIcon, MenuIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { ActionBar } from "@/components/site/action-bar";
import { MobileMenu } from "@/components/site/mobile-menu";
import { bookTarget, navItems } from "@/components/site/navigation";
import { NotFoundContent } from "@/components/site/not-found-content";
import { OfferBanner } from "@/components/site/offer-banner";
import { OpenStatusView } from "@/components/site/open-status";
import { Section } from "@/components/site/section";
import { ReviewCard } from "@/components/site/review-card";
import { SampleBadge } from "@/components/site/sample-badge";
import { ScrollScene } from "@/components/site/scroll-scene";
import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { ServiceTile } from "@/components/site/service-tile";
import { SiteFooter } from "@/components/site/site-footer";
import { MobileMenuContent, SiteHeader } from "@/components/site/site-header";
import { StatTile } from "@/components/site/stat-tile";
import { VehicleIllustration } from "@/components/site/vehicle-illustration";
import { VisualSlot } from "@/components/site/visual-slot";
import { Wordmark } from "@/components/site/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { selectReviews, selectTrustStats } from "@/content/home";
import { services } from "@/content/services";
import { formatRupees } from "@/i18n/format";
import { whatsappHref } from "@/lib/contact-links";
import { devOnly } from "@/lib/dev-only";
import { countDuration, distance, duration, ease } from "@/lib/motion";
import { readGarage } from "@/server/dal/garage";

import { ColorPair } from "./_components/color-pair";
import { FontPreview, FontToggle } from "./_components/font-switch";
import { MotionDemo } from "./_components/motion-demo";

// /dev/design: the whole design system on one page, so the owner can judge it
// and later tasks can copy from it. Development only: devOnly() makes it a
// 404 in production builds. Demo text is typed here on purpose (eslint.config.mjs
// lets dev pages do that); real product text still comes from messages.

// devOnly() comes first here too. A 404 from the page alone would keep this
// page's own title on the production 404; a 404 thrown while the metadata is
// worked out gives it the 404 page's title instead ([locale]/not-found.tsx).
export function generateMetadata(): Metadata {
  devOnly();
  return {
    title: "Design system",
    // devOnly() already answers with a 404 and noindex in production. This
    // keeps the page out of search results even if that gate ever changes.
    robots: { index: false, follow: false },
  };
}

// The pairs design-tokens.test.ts checks, in plain words.
const textPairs = [
  ["Page text", "foreground", "background"],
  ["Page text on a tile", "foreground", "card"],
  ["Page text on a muted fill", "foreground", "muted"],
  ["Tile text", "card-foreground", "card"],
  ["Popover text", "popover-foreground", "popover"],
  ["Main button", "primary-foreground", "primary"],
  ["Main button, hovered", "primary-foreground", "primary-hover"],
  ["Secondary button", "secondary-foreground", "secondary"],
  ["Hover wash", "accent-foreground", "accent"],
  ["Secondary text", "muted-foreground", "background"],
  ["Secondary text on a tile", "muted-foreground", "card"],
  ["Secondary text on a muted fill", "muted-foreground", "muted"],
  ["Secondary text on a secondary fill", "muted-foreground", "secondary"],
  ["Text link", "link", "background"],
  ["Text link on a tile", "link", "card"],
  ["Error text", "destructive", "background"],
  ["Error text on a tile", "destructive", "card"],
  ["Destructive button", "destructive-foreground", "destructive"],
  ["Status text", "success", "background"],
  ["Status text on a tile", "success", "card"],
  ["Status badge", "success-foreground", "success"],
] as const;

const linePairs = [
  ["Field border", "input", "background"],
  ["Field border on a tile", "input", "card"],
  ["Field border on a muted fill", "input", "muted"],
  ["Focus outline", "ring", "background"],
  ["Focus outline on a tile", "ring", "card"],
  ["Focus outline on a muted fill", "ring", "muted"],
] as const;

const typeScale = [
  ["type-hero", "48 to 88px, semibold", "The home page hero, nowhere else", "Your car, looked after."],
  ["type-display", "40 to 64px, semibold", "Showcase headlines", "Service you can watch."],
  ["type-headline", "32 to 48px, semibold", "Section headings", "Periodic service"],
  ["type-title", "24 to 32px, semibold", "Tile and card titles", "Brake pads and discs"],
  ["type-lead", "19 to 24px, regular", "The line under a headline", "Free pick-up and drop within 8 km, with photos of every part we change."],
  ["type-body", "17px, regular", "Running text", "We check 40 points on every visit, from tyre pressure to brake fluid, and tell you what needs doing before we start any work."],
  ["type-callout", "15px, regular", "Secondary text and small buttons", "Open Monday to Saturday, 9 am to 7 pm."],
  ["type-caption", "13px, regular", "Fine print, the smallest size", "Prices include labour. Parts are billed at MRP."],
] as const;

// Sizes for reading, kept under about 75 characters a line.
const textSizes = new Set<string>(["type-lead", "type-body", "type-callout", "type-caption"]);

const radii = [
  ["rounded-sm", "6px", "Small accents"],
  ["rounded-md", "10px", "Menu items"],
  ["rounded-lg", "12px", "Fields and popovers"],
  ["rounded-xl", "18px", "Cards and tiles"],
  ["rounded-2xl", "24px", "Large panels"],
  ["rounded-3xl", "28px", "Framed bands"],
  ["rounded-4xl", "Pill", "Badges"],
  ["rounded-full", "Pill", "Buttons"],
] as const;

const durationUse = {
  fast: "Press and hover feedback",
  base: "Menus and small transitions",
  slow: "Sheets and overlays",
  reveal: "Scroll reveals",
};

const easeUse = {
  standard: "Most motion",
  emphasized: "Big entrances, a long settle",
  exit: "Things leaving",
};

// The scroll scene's GSAP-only values (distance and countDuration in @/lib/motion).
const scrollValues = [
  ["distance.reveal", `${distance.reveal}px`, "How far a reveal rises into place, from 768px up"],
  ["distance.revealPhone", `${distance.revealPhone}px`, "The same on phones, below 768px"],
  ["distance.stagger", `${Math.round(distance.stagger * 1000)}ms`, "Between tiles that reveal together (phones don't stagger)"],
  ["distance.storyScale", `${distance.storyScale} to 1`, "The story's picture grows to its natural size, never past it"],
  ["countDuration", `${Math.round(countDuration * 1000)}ms`, "A number counting up: about twice a reveal"],
] as const;

const tones = [
  ["white", "On the white page"],
  ["grey", "On the grey band"],
  ["dark", "On the black showcase"],
] as const;

const sections = [
  ["brand", "Brand"],
  ["colour", "Colour"],
  ["type", "Type"],
  ["shape", "Space and shape"],
  ["components", "Components"],
  ["shell", "Layout shell"],
  ["blocks", "Page blocks"],
  ["motion", "Motion"],
  ["rules", "Rules"],
] as const;

const price = formatRupees(249_900, "en");

// Layout shell samples: every menu item as if its page were live, and a demo
// offer whose link counts as live.
const allPagesLive = navItems.map((item) => ({ ...item, live: true }));
const demoOffer = { text: { en: "10% off every car service this week" }, href: "/packages" };
// The open status in each state, at fixed times (26 Oct 2026 is a Monday).
const statusSamples = [
  ["Open, Tuesday 11:00", { isOpen: true, closesAt: new Date("2026-10-27T13:30:00Z") }],
  [
    "Before opening, Tuesday 09:00",
    { isOpen: false, nextOpening: { at: new Date("2026-10-27T04:30:00Z"), when: "today", weekday: "tuesday" } },
  ],
  [
    "Monday, closed all day",
    { isOpen: false, nextOpening: { at: new Date("2026-10-27T04:30:00Z"), when: "tomorrow", weekday: "tuesday" } },
  ],
  [
    "Sunday night",
    { isOpen: false, nextOpening: { at: new Date("2026-11-03T04:30:00Z"), when: "later", weekday: "tuesday" } },
  ],
] as const;

/** A titled group inside a section. */
function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <h3 className="type-title">{title}</h3>
        {description && <p className="type-callout text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A section's heading and the line under it. */
function SectionIntro({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <h2 id={id} className="type-headline scroll-mt-20 text-balance">
        {title}
      </h2>
      <p className="type-lead text-pretty text-muted-foreground">{lead}</p>
    </div>
  );
}

/** Every colour pair, as measured swatches, on the surrounding tone. */
function PairGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {textPairs.map(([label, foreground, surface]) => (
        <ColorPair key={`${foreground}-${surface}`} label={label} foreground={foreground} surface={surface} />
      ))}
      {linePairs.map(([label, line, surface]) => (
        <ColorPair key={`${line}-${surface}`} label={label} foreground={line} surface={surface} kind="line" />
      ))}
    </div>
  );
}

/** The site icon at the sizes browsers and phones use. */
function IconSizes() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      {[16, 32, 64, 180].map((size) => (
        <div key={size} className="flex flex-col items-start gap-2">
          <Image src="/icon.svg" alt="" width={size} height={size} />
          <span className="type-caption text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  );
}

/** One half of a do and don't pair. */
function Example({ verdict, rule, children }: { verdict: "Do" | "Don't"; rule: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex min-h-40 flex-wrap items-center justify-center gap-3 rounded-xl border border-border p-6">
        {children}
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <span className={verdict === "Do" ? "type-callout font-semibold" : "type-callout font-semibold text-destructive"}>
          {verdict}
        </span>
        <span className="type-callout text-muted-foreground">{rule}</span>
      </figcaption>
    </figure>
  );
}

// Async because the shell samples show the garage's real details, read from
// the database.
export default async function DesignPage() {
  devOnly();
  const tCommon = await getTranslations("Common");
  const tHeader = await getTranslations("Header");
  const tContact = await getTranslations("Contact");
  const garage = await readGarage();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));
  // The samples, through the same switch the home page uses (showSamples()):
  // devOnly() keeps this page out of production, but a staging server that
  // shows dev pages must still show no samples. null there: the blocks below go.
  const shownStats = selectTrustStats(null);
  const shownReviews = selectReviews(null);

  return (
    <FontPreview>
      <header className="frosted sticky top-0 z-10 border-b border-border">
        <div className="mx-auto box-content flex h-14 max-w-wide items-center justify-between gap-4 px-(--gutter)">
          <Wordmark className="type-lead" />
          <FontToggle />
        </div>
      </header>

      <main>
        <Section width="wide">
          <div className="flex flex-col gap-8">
            <div className="flex max-w-3xl flex-col gap-4">
              <h1 className="type-display text-balance">Design system</h1>
              <p className="type-lead text-muted-foreground">
                Every colour, type size, component and movement the site is built from, on one page. It only
                exists under npm run dev. Switch the font at the top to see what Android and Windows visitors get.
              </p>
            </div>
            <nav aria-label="Sections of this page" className="flex flex-wrap gap-2">
              {sections.map(([id, label]) => (
                <Button key={id} asChild size="sm" variant="secondary">
                  <a href={`#${id}`}>{label}</a>
                </Button>
              ))}
            </nav>
          </div>
        </Section>

        <Section tone="grey" width="wide" aria-labelledby="brand">
          <div className="flex flex-col gap-12">
            <SectionIntro
              id="brand"
              title="Brand"
              lead="The name is set in Inter on every device, and the icon is its first letter on a near-black tile. Both come from one place, so a rename stays small."
            />
            {/* Side by side only from 1024px: below that the large wordmark is wider than half the page. */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="[--card-spacing:var(--gutter)]">
                <CardContent className="flex flex-col gap-6">
                  <Wordmark className="type-display" />
                  <div className="flex flex-col gap-1">
                    <Wordmark className="type-lead" />
                    <span className="type-caption text-muted-foreground">Header size, type-lead</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Wordmark className="type-callout" />
                    <span className="type-caption text-muted-foreground">Footer size, type-callout</span>
                  </div>
                </CardContent>
              </Card>
              <Section tone="dark" className="rounded-xl py-(--gutter)">
                <div className="flex flex-col gap-6">
                  <Wordmark className="type-display" />
                  <div className="flex flex-col gap-1">
                    <Wordmark className="type-lead" />
                    <span className="type-caption text-muted-foreground">On the black showcase</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Wordmark className="type-callout" />
                    <span className="type-caption text-muted-foreground">Footer size on black</span>
                  </div>
                </div>
              </Section>
            </div>

            <Block title="Icon" description="Drawn as an outline, so every browser shows the same letter. In a dark browser tab bar it gets a light edge.">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="[--card-spacing:var(--gutter)]">
                  <CardContent>
                    <IconSizes />
                  </CardContent>
                </Card>
                <Section tone="dark" className="rounded-xl py-(--gutter)">
                  <IconSizes />
                </Section>
              </div>
            </Block>

            <Block title="Renaming the brand" description="The name may change later. These steps are the whole job.">
              <Card className="max-w-3xl">
                <CardContent>
                  <ol className="flex list-decimal flex-col gap-3 pl-5">
                    <li>
                      In messages/en.json, change Brand.name and Metadata.title, the only other message that types the
                      name (the 404 title reads it through {"{brand}"}).
                    </li>
                    <li>Redraw the letter in src/app/icon.svg. It is an outline, so a new letter needs a new path.</li>
                    <li>Run npm run check. brand-name.test.ts lists any file that still types the old name.</li>
                  </ol>
                </CardContent>
              </Card>
            </Block>
          </div>
        </Section>

        <Section width="wide" aria-labelledby="colour">
          <div className="flex flex-col gap-12">
            <SectionIntro
              id="colour"
              title="Colour"
              lead="White and light grey surfaces, near-black text, one blue for actions and black for showcase bands. Every pair below is measured live: text needs 4.5:1, field borders and focus outlines 3:1."
            />
            <Block title="On the white page">
              <PairGrid />
            </Block>
          </div>
        </Section>

        <Section tone="grey" width="wide">
          <Block title="On the grey band" description="Tiles turn white and muted fills a shade darker. Nothing else changes.">
            <PairGrid />
          </Block>
        </Section>

        <Section tone="dark" width="wide">
          <Block title="On the black showcase" description="Text, links and status colours lighten so they still read on black.">
            <PairGrid />
          </Block>
        </Section>

        <Section width="wide" aria-labelledby="type">
          <div className="flex flex-col gap-12">
            <SectionIntro
              id="type"
              title="Type"
              lead="Large, tightly set headlines and 17px running text. Sizes grow with the screen and with the browser's zoom."
            />
            <div className="flex flex-col">
              {typeScale.map(([token, spec, use, sample]) => (
                <div key={token} className="flex flex-col gap-3 border-t border-border py-8 md:flex-row md:gap-10">
                  <div className="flex shrink-0 flex-col gap-0.5 md:w-56">
                    <span className="type-callout font-semibold">{token}</span>
                    <span className="type-caption text-muted-foreground">{spec}</span>
                    <span className="type-caption text-muted-foreground">{use}</span>
                  </div>
                  <p className={`${token} min-w-0 ${textSizes.has(token) ? "max-w-2xl" : "max-w-4xl"}`}>{sample}</p>
                </div>
              ))}
              <div className="flex flex-col gap-3 border-t border-border py-8 md:flex-row md:gap-10">
                <div className="flex shrink-0 flex-col gap-0.5 md:w-56">
                  <span className="type-callout font-semibold">Hindi</span>
                  <span className="type-caption text-muted-foreground">type-title inside lang=&quot;hi&quot;</span>
                  <span className="type-caption text-muted-foreground">No negative letter-spacing, taller lines</span>
                </div>
                <p lang="hi" data-hindi-specimen className="type-title min-w-0">
                  आपकी कार और बाइक की पूरी सर्विस, एक ही जगह।
                </p>
              </div>
              <div className="flex flex-col gap-3 border-t border-b border-border py-8 md:flex-row md:gap-10">
                <div className="flex shrink-0 flex-col gap-0.5 md:w-56">
                  <span className="type-callout font-semibold">Price</span>
                  <span className="type-caption text-muted-foreground">formatRupees(249900), in paise</span>
                  <span className="type-caption text-muted-foreground">Indian digit grouping and the ₹ sign</span>
                </div>
                <p className="type-display min-w-0 tabular-nums">From {price}</p>
              </div>
            </div>
            <Block title="Running text" description="A paragraph at body size, to judge line length and rhythm.">
              <p className="type-body max-w-2xl">
                Book a slot online and we collect your car or scooter from your door. Our mechanics send photos of
                every worn part before they replace it, and nothing is fitted without your OK. Most periodic services
                are ready the same day.{" "}
                <a href="#components" className="text-link underline underline-offset-4">
                  See what a service includes
                </a>
                .
              </p>
            </Block>
          </div>
        </Section>

        <Section tone="grey" width="wide" aria-labelledby="shape">
          <div className="flex flex-col gap-16">
            <SectionIntro
              id="shape"
              title="Space and shape"
              lead="Generous space between sections, rounded tiles without shadows, and shadows only for things that float over the page."
            />

            <Block title="Spacing" description="Both grow with the screen: tight on a phone, roomy on a desktop.">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-(--section-space) rounded-full bg-foreground" />
                  <span className="type-callout">Section space, 64 to 128px: above and below every section</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-(--gutter) rounded-full bg-foreground" />
                  <span className="type-callout">Gutter, 20 to 40px: the space at the sides of the content</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-full max-w-content rounded-full bg-muted-foreground" />
                  <span className="type-callout">Content width, 980px: text and most sections</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-full max-w-wide rounded-full bg-muted-foreground" />
                  <span className="type-callout">Wide width, 1280px: grids and galleries</span>
                </div>
              </div>
            </Block>

            <Block title="Radius">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {radii.map(([className, value, use]) => (
                  <div key={className} className="flex flex-col gap-3">
                    <div className={`${className} size-24 bg-card`} />
                    <div className="flex flex-col gap-0.5">
                      <span className="type-callout font-semibold">{className}</span>
                      <span className="type-caption text-muted-foreground">{value}</span>
                      <span className="type-caption text-muted-foreground">{use}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Block>

            <Block
              title="Elevation"
              description="Tiles and bands are flat. The soft shadows are only for layers above the page: the sheet, popovers and, later, the sticky action bar."
            >
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[
                  ["Flat", "", "Tiles, cards and bands"],
                  ["shadow-sm", "shadow-sm", "Small popovers"],
                  ["shadow-md", "shadow-md", "Menus"],
                  ["shadow-lg", "shadow-lg", "The sheet and dialogs"],
                ].map(([name, shadow, use]) => (
                  <div key={name} className="flex flex-col gap-3">
                    <div className={`${shadow} h-24 rounded-xl bg-popover`} />
                    <div className="flex flex-col gap-0.5">
                      <span className="type-callout font-semibold">{name}</span>
                      <span className="type-caption text-muted-foreground">{use}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Block>

            <Block
              title="Frosted bar"
              description="For the header: the page shows through, blurred. Solid where the browser can't blur, or when the visitor asks for less transparency."
            >
              <div className="relative h-48 overflow-hidden rounded-xl">
                <div className="grid h-full grid-cols-4">
                  <div className="bg-primary" />
                  <div className="bg-success" />
                  <div className="bg-foreground" />
                  <div className="bg-destructive" />
                </div>
                <div className="frosted absolute inset-x-0 top-8 flex h-14 items-center justify-between gap-4 px-6">
                  <Wordmark className="type-lead" />
                  <span className="type-callout">Prices</span>
                </div>
              </div>
            </Block>
          </div>
        </Section>

        <Section width="wide" aria-labelledby="components">
          <div className="flex flex-col gap-16">
            <SectionIntro
              id="components"
              title="Components"
              lead="Pill buttons, flat tiles and fields at least 44px tall, so every control suits a thumb."
            />

            <Block title="Buttons" description="One main action per group. The others step down in weight.">
              <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Book a service</Button>
                  <Button variant="secondary">See prices</Button>
                  <Button variant="outline">
                    <PhoneIcon data-icon="inline-start" />
                    Call the garage
                  </Button>
                  <Button variant="ghost">Not now</Button>
                  <Button variant="destructive">Cancel booking</Button>
                  <Button variant="link">Read the price list</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Book a service</Button>
                  <Button disabled>Book a service</Button>
                  <Button disabled>
                    <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                    Booking
                  </Button>
                  <span className="type-caption text-muted-foreground">Default, disabled, busy</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs">Edit</Button>
                  <Button size="sm">Change slot</Button>
                  <Button>Book a service</Button>
                  <Button size="lg">Book a service</Button>
                  <span className="type-caption text-muted-foreground">
                    xs 32px and sm 36px grow to 44px on touch screens. Default 44px, lg 48px.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="icon-xs" variant="outline" aria-label="Call the garage">
                    <PhoneIcon />
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Call the garage">
                    <PhoneIcon />
                  </Button>
                  <Button size="icon" variant="outline" aria-label="Call the garage">
                    <PhoneIcon />
                  </Button>
                  <Button size="icon-lg" aria-label="Chat on WhatsApp">
                    <MessageCircleIcon />
                  </Button>
                  <span className="type-caption text-muted-foreground">Icon buttons always have a label for screen readers</span>
                </div>
              </div>
            </Block>

            <Separator />

            <Block title="Badges" description="Short labels for status and type. Green is for status only.">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">Open now</Badge>
                <Badge variant="destructive">Closed today</Badge>
                <Badge variant="secondary">Two-wheeler</Badge>
                <Badge variant="outline">Diesel</Badge>
                <Badge>New</Badge>
              </div>
            </Block>

            <Separator />

            <Block title="Cards in each tone" description="Grey tiles on the white page, white tiles on the grey band, dark tiles on black.">
              <div className="grid gap-4 lg:grid-cols-3">
                {(["white", "grey", "dark"] as const).map((tone) => (
                  <Section key={tone} tone={tone} className="rounded-xl border border-border py-(--gutter)">
                    <Card>
                      <CardHeader>
                        <CardTitle>Periodic service</CardTitle>
                        <CardDescription>Every 10,000 km or six months, whichever comes first.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col items-start gap-4">
                        <p className="type-lead">From {price}</p>
                        <Button>Book a service</Button>
                      </CardContent>
                    </Card>
                  </Section>
                ))}
              </div>
            </Block>

            <Separator />

            <Block title="Fields" description="Labels sit above the field. Errors appear under it, in words that say how to fix them.">
              <FieldGroup className="grid gap-6 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
                  <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" />
                  <FieldDescription>We send booking updates by SMS.</FieldDescription>
                </Field>
                <Field data-invalid>
                  <FieldLabel htmlFor="phone-invalid">Mobile number</FieldLabel>
                  <Input
                    id="phone-invalid"
                    type="tel"
                    inputMode="numeric"
                    defaultValue="98765"
                    aria-invalid
                    aria-describedby="phone-invalid-error"
                  />
                  <FieldError id="phone-invalid-error">Enter all 10 digits of your mobile number.</FieldError>
                </Field>
                <Field data-disabled>
                  <FieldLabel htmlFor="phone-disabled">Mobile number</FieldLabel>
                  <Input id="phone-disabled" type="tel" defaultValue="98765 43210" disabled />
                  <FieldDescription>Locked after booking. Call us to change it.</FieldDescription>
                </Field>
              </FieldGroup>
            </Block>

            <Separator />

            <Block title="Sheet" description="The plain component. The real phone menu is under Layout shell. Its close button's label comes from messages.">
              <div data-sample="sheet">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">
                      <MenuIcon data-icon="inline-start" />
                      Open the menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent closeLabel={tCommon("close")}>
                    <SheetHeader>
                      <SheetTitle>Menu</SheetTitle>
                      <SheetDescription>Jump to a part of this page.</SheetDescription>
                    </SheetHeader>
                    <nav aria-label="Sections of this page" className="flex flex-col gap-1 px-4">
                      {sections.map(([id, label]) => (
                        <SheetClose key={id} asChild>
                          <Button asChild variant="ghost" className="justify-start">
                            <a href={`#${id}`}>{label}</a>
                          </Button>
                        </SheetClose>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
            </Block>
          </div>
        </Section>

        {/* White, like the public pages, so the header and 404 samples show their real
            colours (inside a grey band, bg-background turns grey too). */}
        <Section width="wide" aria-labelledby="shell">
          <div className="flex flex-col gap-16">
            <SectionIntro
              id="shell"
              title="Layout shell"
              lead="The frame around every public page, with the garage's real details. Here every menu item is shown as if its page were live, with a demo offer."
            />

            <Block
              title="Header"
              description="Frosted and sticky on the real pages. Links appear once their page is live. Below 768px they make way for the menu button."
            >
              {/* isolate: the header's z-40 stays inside this box, below this page's own sticky header. */}
              <div data-sample="header" className="isolate overflow-hidden rounded-xl border border-border bg-background">
                <SiteHeader items={allPagesLive} book={book} garage={garage} />
              </div>
            </Block>

            <Block
              title="Phone menu"
              description="The menu button opens it on phones. It holds the live pages, the open status, the hours, the address, and Call and WhatsApp."
            >
              <div data-sample="phone-menu">
                <MobileMenu openLabel={tHeader("openMenu")} title={tHeader("menuTitle")} closeLabel={tCommon("close")}>
                  <MobileMenuContent items={allPagesLive} garage={garage} />
                </MobileMenu>
              </div>
            </Block>

            <div className="grid gap-10 md:grid-cols-2">
              <Block
                title="Open status"
                description="Worked out in the visitor's browser, in India time, and updated every minute. These are fixed examples."
              >
                <dl className="flex flex-col gap-4">
                  {statusSamples.map(([label, status]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <dt className="type-caption text-muted-foreground">{label}</dt>
                      <dd>
                        <OpenStatusView status={status} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </Block>

              <Block
                title="Phone bar"
                description="Fixed to the bottom of phones, below 768px. Shown here in place, 320px wide: the narrowest phone."
              >
                {/* A 320px phone screen: box-content keeps the border outside the
                    320px. --gutter follows the window's width, so the phone's own
                    gutter is set here: the bar then looks exactly as on a real phone. */}
                <div
                  data-sample="action-bar"
                  className="box-content w-80 max-w-full overflow-hidden rounded-xl border border-border [--gutter:var(--gutter-min)]"
                >
                  <ActionBar book={book} garage={garage} className="static md:block" />
                </div>
              </Block>
            </div>

            <Block title="Offer banner" description="Under the header when there's an offer; nothing at all when there isn't (today).">
              <div className="overflow-hidden rounded-xl border border-border">
                <OfferBanner offer={demoOffer} pages={[{ href: "/packages", live: true }]} />
              </div>
            </Block>

            <Block title="Footer" description="On every public page: contact details, the weekly hours with the live status, and the live pages.">
              <div className="overflow-hidden rounded-xl border border-border">
                <SiteFooter items={allPagesLive} garage={garage} />
              </div>
            </Block>

            <Block
              title="404 content"
              description="Both 404 pages show this: inside the full shell for unknown URLs, under a slim bar for pages that call notFound()."
            >
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <NotFoundContent garage={garage} titleAs="h2" />
              </div>
            </Block>
          </div>
        </Section>

        <Section width="wide" aria-labelledby="blocks">
          <div className="flex flex-col gap-16">
            <SectionIntro
              id="blocks"
              title="Page blocks"
              lead="The pieces the home page is built from, ready for the service, about and review pages. Made-up stats and reviews carry a Sample badge: only npm run dev ever shows them."
            />

            <Block
              title="Vehicle illustration"
              description="Line art in the text colour around it, so it suits every tone. It stands in wherever there's no photo yet."
            >
              <div data-sample="illustrations" className="grid gap-4 md:grid-cols-3">
                {tones.map(([tone, label]) => (
                  <Section key={tone} tone={tone} className="rounded-xl border border-border py-(--gutter)">
                    <div className="flex flex-col gap-3 text-muted-foreground">
                      <VehicleIllustration className="w-full" />
                      <span className="type-caption">{label}</span>
                    </div>
                  </Section>
                ))}
              </div>
            </Block>

            <Block
              title="Visual slot"
              description="A fixed 16:10 box, so nothing moves when a photo arrives. A photo fills it once there is one; until then, the illustration. The hero's slot loads its photo eagerly."
            >
              <VisualSlot data-sample="visual-slot" photo={null} sizes="(min-width: 48rem) 36rem, 100vw" className="max-w-xl" />
            </Block>

            <Block
              title="Service tiles"
              description="Flat tiles, not links: there are no service pages or prices yet. Periodic service gets the wide tile in the grid."
            >
              <Section tone="grey" className="rounded-xl py-(--gutter)">
                <ul data-sample="service-tiles" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <li className="sm:col-span-2">
                    <ServiceTile service={services[0]} />
                  </li>
                  <li>
                    <ServiceTile service={services[1]} />
                  </li>
                </ul>
              </Section>
            </Block>

            {shownStats && (
              <Block
                title="Trust stats"
                description="The samples the home page shows under npm run dev. Screen readers hear the label and the final number; the number on screen is the one that counts up."
              >
                <dl data-sample="stat-tiles" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                  {shownStats.items.map((stat) => (
                    <StatTile key={stat.id} stat={stat} sample={shownStats.sample} />
                  ))}
                </dl>
              </Block>
            )}

            {shownReviews && (
              <Block
                title="Review card"
                description="Stars for the eye, the rating in words for screen readers. A sample is credited to a vehicle, never a name."
              >
                <Section tone="grey" className="rounded-xl py-(--gutter)">
                  <div data-sample="review-card" className="max-w-md">
                    <ReviewCard review={shownReviews.items[2]} sample={shownReviews.sample} />
                  </div>
                </Section>
              </Block>
            )}

            <Block
              title="Sample badge"
              description="On every made-up stat and review. Production builds never include samples, so they never show it."
            >
              <div data-sample="sample-badge">
                <SampleBadge />
              </div>
            </Block>

            <Block
              title="Scroll scene"
              description="ScrollScene wraps server-rendered markup and moves only what is marked: a line that rises into place, tiles that follow one another, a number that counts up. It plays once, the first time each part scrolls into view. With reduce motion on, nothing moves."
            >
              <div data-sample="scroll-scene">
                <ScrollScene>
                  <div className="flex flex-col gap-6 rounded-xl border border-border p-(--gutter)">
                    <p {...sceneMark("reveal")} className="type-title">
                      This line rises into place.
                    </p>
                    <ul {...sceneMark("revealGroup")} className="grid grid-cols-3 gap-3">
                      {["One", "Two", "Three"].map((label) => (
                        <li key={label} className="rounded-xl bg-card p-6 type-callout">
                          {label}
                        </li>
                      ))}
                    </ul>
                    {shownStats && (
                      <dl className="grid max-w-xs">
                        <StatTile stat={shownStats.items[1]} sample={shownStats.sample} />
                      </dl>
                    )}
                  </div>
                </ScrollScene>
              </div>
            </Block>
          </div>
        </Section>

        <Section tone="grey" width="wide" aria-labelledby="motion">
          <div className="flex flex-col gap-12">
            <SectionIntro
              id="motion"
              title="Motion"
              lead="A few durations and three easings, shared by CSS and GSAP. Visitors who turn on reduce motion get the end state straight away."
            />
            <div className="grid gap-10 md:grid-cols-2">
              <Block title="Durations">
                <dl className="flex flex-col">
                  {Object.entries(duration).map(([name, seconds]) => (
                    <div key={name} className="flex items-baseline justify-between gap-4 border-t border-border py-3">
                      <dt className="flex flex-col">
                        <span className="type-callout font-semibold">{name}</span>
                        <span className="type-caption text-muted-foreground">{durationUse[name as keyof typeof durationUse]}</span>
                      </dt>
                      <dd className="type-callout tabular-nums">{Math.round(seconds * 1000)}ms</dd>
                    </div>
                  ))}
                </dl>
              </Block>
              <Block title="Easing">
                <dl className="flex flex-col">
                  {Object.entries(ease).map(([name, { gsap, css }]) => (
                    <div key={name} className="flex flex-col gap-1 border-t border-border py-3">
                      <dt className="flex items-baseline justify-between gap-4">
                        <span className="type-callout font-semibold">{name}</span>
                        <span className="type-callout">{gsap}</span>
                      </dt>
                      <dd className="type-caption text-muted-foreground">
                        {easeUse[name as keyof typeof easeUse]}. CSS: {css}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Block>
            </div>
            <Block
              title="Scroll scene"
              description="GSAP-only values for ScrollScene's reveals, stagger, story and counts. CSS never moves things this way, so it has no copy."
            >
              <dl data-sample="scroll-values" className="flex max-w-3xl flex-col">
                {scrollValues.map(([name, value, use]) => (
                  <div key={name} className="flex items-baseline justify-between gap-4 border-t border-border py-3">
                    <dt className="flex flex-col">
                      <span className="type-callout font-semibold">{name}</span>
                      <span className="type-caption text-muted-foreground">{use}</span>
                    </dt>
                    <dd className="type-callout tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </Block>
            <Block
              title="Try it"
              description="The tile uses duration.reveal and ease.emphasized. With reduce motion on, it jumps to the end."
            >
              <MotionDemo />
            </Block>
          </div>
        </Section>

        <Section tone="dark" width="wide">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="success">Open now</Badge>
            <h2 className="type-display max-w-3xl text-balance">Brake check, done in an hour.</h2>
            <p className="type-lead max-w-2xl text-muted-foreground">
              Book a slot, follow the work on your phone, and pay only for what we fix. A showcase band built from the
              same components, inside a dark section.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Book a service</Button>
              <Button size="lg" variant="secondary">
                See prices
              </Button>
            </div>
            <p className="type-caption text-muted-foreground">Pick-up within 8 km. Prices include labour.</p>
          </div>
        </Section>

        <Section width="wide" aria-labelledby="rules">
          <div className="flex flex-col gap-12">
            <SectionIntro
              id="rules"
              title="Rules"
              lead="The four rules that are easiest to break. Each one keeps the site calm and fast."
            />
            <div className="grid gap-x-6 gap-y-12 md:grid-cols-2">
              <Example verdict="Do" rule="One main action per group, the rest step down.">
                <Button>Book a service</Button>
                <Button variant="secondary">See prices</Button>
              </Example>
              <Example verdict="Don't" rule="Two blue buttons side by side: nobody knows which one matters.">
                <Button>Book a service</Button>
                <Button>See prices</Button>
              </Example>
              <Example verdict="Do" rule="Blue is for things you can press. Status uses green.">
                <Badge variant="success">Open now</Badge>
                <Button>Book a service</Button>
              </Example>
              <Example verdict="Don't" rule="Blue status labels and headings look pressable.">
                <Badge>Open now</Badge>
                <span className="type-title text-primary">Our services</span>
              </Example>
              <Example verdict="Do" rule="Tiles are flat. Their fill sets them apart.">
                <Card className="w-72">
                  <CardHeader>
                    <CardTitle>Wheel alignment</CardTitle>
                    <CardDescription>From {formatRupees(79_900, "en")}</CardDescription>
                  </CardHeader>
                </Card>
              </Example>
              <Example verdict="Don't" rule="A shadow under every tile looks like a template and adds noise.">
                <Card className="w-72 shadow-lg ring-1 ring-border">
                  <CardHeader>
                    <CardTitle>Wheel alignment</CardTitle>
                    <CardDescription>From {formatRupees(79_900, "en")}</CardDescription>
                  </CardHeader>
                </Card>
              </Example>
              <Example verdict="Do" rule="Content is visible before any script runs. Animation only moves it.">
                <p className="type-title">Periodic service</p>
              </Example>
              <Example verdict="Don't" rule="Text hidden until a script fades it in: on slow 4G the page stays blank.">
                <p className="type-title opacity-0">Periodic service</p>
              </Example>
            </div>
          </div>
        </Section>
      </main>

      <footer>
        <Section tone="grey" width="wide" className="py-12">
          <div className="flex flex-col gap-2">
            <Wordmark className="type-callout" />
            <p className="type-caption text-muted-foreground">
              Development preview. Production builds answer this address with a 404 page.
            </p>
          </div>
        </Section>
      </footer>
    </FontPreview>
  );
}
