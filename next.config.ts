import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Connects next-intl to src/i18n/request.ts (its default location).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
