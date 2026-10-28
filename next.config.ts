import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Connects next-intl to src/i18n/request.ts (its default location).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Load PGlite (the local database, task 14) with Node's own require instead
  // of bundling it. PGlite reads its .wasm and .data files from the folder
  // next to its own code; a bundled copy looks in the wrong folder.
  serverExternalPackages: ["@electric-sql/pglite"],
  // `next build` lists every file the server code might read, so a deployment
  // can copy them. It follows `path.join(process.cwd(), ".pglite")` in
  // src/server/db/index.ts into your local database: leave that out, for
  // every route ("/*"). A deployment uses its own Postgres (task 20).
  outputFileTracingExcludes: { "/*": ["./.pglite/**"] },
  experimental: {
    // Needed because the root layout lives inside [locale]: URLs that match
    // no route at all get src/app/global-not-found.tsx.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
