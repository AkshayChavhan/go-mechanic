import { notFound } from "next/navigation";

// The one gate for development-only pages (/dev/design now, /dev/outbox
// later). Call it first thing in the page:
//
//   export default function DesignPage() {
//     devOnly();
//     ...
//   }
//
// Under `npm run dev` the page renders. Anywhere else it's a 404:
// - Next.js writes the value of NODE_ENV into the code at build time, so a
//   production build bakes the 404 in, and the page can stay static.
// - notFound() also adds <meta name="robots" content="noindex">, so search
//   engines skip the URL.
// To show a dev page on staging (a production build), change this one function.
export function devOnly(): void {
  if (process.env.NODE_ENV !== "development") notFound();
}
