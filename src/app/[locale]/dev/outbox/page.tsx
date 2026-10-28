import type { Metadata } from "next";
import { useLocale } from "next-intl";
import { Suspense } from "react";

import { Section } from "@/components/site/section";
import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import { devOnly } from "@/lib/dev-only";

import { OutboxMessages } from "./_components/outbox-messages";

// /dev/outbox: the messages the fake SMS provider "sent" (task 15), newest
// first, so the owner can log in under `npm run dev` from a phone: ask for a
// code on /login, read it here. Development only: devOnly() makes it a 404
// with noindex everywhere else. Demo text is typed here on purpose (dev pages
// may), but the brand name only ever comes from messages (the Wordmark).

// devOnly() first here too: a 404 thrown while the metadata is worked out
// gives the production 404 the 404's own title, not "Outbox".
export function generateMetadata(): Metadata {
  devOnly();
  return {
    title: "Outbox",
    // devOnly() already answers with a 404 and noindex in production. This
    // keeps the page out of search results even if that gate ever changes.
    robots: { index: false, follow: false },
  };
}

export default function OutboxPage() {
  devOnly();
  const locale = useLocale();

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto box-content flex h-(--header-height) max-w-wide items-center px-(--gutter)">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Wordmark className="type-lead" />
          </Link>
        </div>
      </header>
      <main id="main">
        <Section width="wide">
          <div className="flex max-w-2xl flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="type-headline">Outbox</h1>
              <p className="type-lead text-pretty text-muted-foreground">
                Every SMS the fake provider has sent, newest first. Nothing leaves this computer. A login code
                works for 5 minutes.
              </p>
            </div>
            {/* A plain link, not a client-side one: the browser loads the page
                again, so the list is read from the database again. */}
            <Button asChild variant="secondary" className="self-start">
              <a href={getPathname({ href: "/dev/outbox", locale })}>Refresh</a>
            </Button>
            <Suspense fallback={<p className="type-body text-muted-foreground">Loading messages…</p>}>
              <OutboxMessages locale={locale} />
            </Suspense>
          </div>
        </Section>
      </main>
    </>
  );
}
