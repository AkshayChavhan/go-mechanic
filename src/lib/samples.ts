// The one gate for sample content: made-up trust stats and reviews that let
// us see the home page's design before the real numbers and reviews exist.
//
// The owner decided on 2026-10-27 that made-up numbers and reviews must never
// reach customers. So samples show under `npm run dev` only:
// - Next.js writes the value of NODE_ENV into the code at build time, so in a
//   production build this is `"production" === "development"`, always false.
//   The page stays static, and a production prerender never renders a sample.
// - Use it through the selectors in src/content/home.ts, which prefer real
//   data whenever it exists.
//
// Why not devOnly() (src/lib/dev-only.ts)? Its comment invites showing dev
// pages on a staging server (a production build) by changing that one
// function. A staging site may be shown to customers, so samples keep their
// own switch, and a change to devOnly() can never turn them on.
export function showSamples(): boolean {
  return process.env.NODE_ENV === "development";
}
