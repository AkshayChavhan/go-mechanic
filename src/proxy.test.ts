import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Next.js's own check of a proxy matcher, the same code the build uses.
// The bundled docs call it unstable_doesProxyMatch; in Next.js 16.4.3 it is
// still exported under its old name, unstable_doesMiddlewareMatch.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, test } from "vitest";

import { NextRequest } from "next/server";

import proxy, { config } from "./proxy";

// The proxy rewrites "/x" to "/en/x". That's right for pages, and wrong for a
// real file: "/en/icon.svg" doesn't exist. So the proxy must skip every file
// the site serves, and run for everything else.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Whether the proxy runs for `url`. */
const runsFor = (url: string) => unstable_doesMiddlewareMatch({ config, url });

/** Every file under a folder, as URL paths ("/images/hero.webp"). None if the folder doesn't exist. */
function urlsOfFilesIn(folder: string): string[] {
  const absolute = path.join(repoRoot, folder);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .filter((file) => statSync(path.join(absolute, file)).isFile())
    .map((file) => `/${file.split(path.sep).join("/")}`);
}

/**
 * The URLs of the metadata files directly in src/app/ (icon.svg today; later
 * robots, sitemap, manifest, Open Graph images). They're served from the
 * site's root, outside [locale]. A file that generates its output (icon.tsx,
 * robots.ts) is served under the name Next.js gives it.
 */
function metadataUrls(): string[] {
  const appFolder = path.join(repoRoot, "src", "app");
  const generatedUrl: Record<string, string> = {
    robots: "/robots.txt",
    sitemap: "/sitemap.xml",
    manifest: "/manifest.webmanifest",
  };
  return readdirSync(appFolder)
    .map((file) => /^(favicon|icon\d*|apple-icon\d*|opengraph-image\d*|twitter-image\d*|robots|sitemap|manifest)\.(\w+)$/.exec(file))
    .filter((match) => match !== null)
    .map(([file, name, extension]) =>
      /^(tsx?|jsx?|mjs)$/.test(extension) ? (generatedUrl[name] ?? `/${name}`) : `/${file}`,
    );
}

describe("the proxy matcher (src/proxy.ts)", () => {
  test.each(["/", "/services", "/en/anything", "/index.html", "/contact.php", "/foo.bar"])(
    "runs for %s (a page, or a dotted URL that should get the branded 404)",
    (url) => {
      expect(runsFor(url)).toBe(true);
    },
  );

  test.each([
    "/icon.svg",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/apple-icon.png",
    "/images/hero.webp",
    "/fonts/inter.woff2",
    "/price-list.pdf",
    "/_next/static/chunk.js",
    "/_vercel/insights/script.js",
    "/api/health",
  ])("skips %s", (url) => {
    expect(runsFor(url)).toBe(false);
  });

  test("skips every file in public/ (the folder may not exist yet)", () => {
    const urls = urlsOfFilesIn("public");
    if (!existsSync(path.join(repoRoot, "public"))) expect(urls).toEqual([]);
    expect(urls.filter(runsFor), "add these files' extensions to the matcher in src/proxy.ts").toEqual([]);
  });

  test("skips every metadata file in src/app/", () => {
    const urls = metadataUrls();
    // icon.svg exists today, so the walk can't silently find nothing.
    expect(urls).toContain("/icon.svg");
    expect(urls.filter(runsFor), "add these files' extensions or paths to the matcher in src/proxy.ts").toEqual([]);
  });

  test("the folder walk handles a missing folder", () => {
    expect(urlsOfFilesIn("no-such-folder")).toEqual([]);
  });
});

describe("the proxy's login redirects (a real request through the proxy, next-intl included)", () => {
  /** Runs the proxy for a request and returns its status and where it points. */
  async function run(path: string, { method = "GET", cookie, headers = {} }: { method?: string; cookie?: string; headers?: Record<string, string> } = {}) {
    const request = new NextRequest(new URL(path, "http://localhost:3000"), {
      method,
      headers: { ...headers, ...(cookie ? { cookie } : {}) },
    });
    const response = await proxy(request);
    const location = response.headers.get("location");
    return {
      status: response.status,
      location: location && new URL(location).pathname + new URL(location).search,
      rewrite: response.headers.get("x-middleware-rewrite"),
    };
  }

  test("GET /account with no cookie: 307 to /login", async () => {
    expect(await run("/account")).toMatchObject({ status: 307, location: "/login" });
  });

  test("GET /account with the http cookie: not sent to /login (next-intl serves the English page)", async () => {
    const result = await run("/account", { cookie: "better-auth.session_token=abc.def" });
    expect(result.location).toBeNull();
    expect(result.rewrite).toMatch(/\/en\/account$/);
  });

  test("GET /login with the https cookie (__Secure-): 307 to /account", async () => {
    expect(await run("/login", { cookie: "__Secure-better-auth.session_token=abc.def" })).toMatchObject({
      status: 307,
      location: "/account",
    });
  });

  test("GET /login with an empty cookie value: no redirect", async () => {
    expect((await run("/login", { cookie: "better-auth.session_token=" })).location).toBeNull();
  });

  test("GET /login?session=ended with a cookie: no redirect (a leftover cookie can't loop)", async () => {
    expect((await run("/login?session=ended", { cookie: "better-auth.session_token=abc.def" })).location).toBeNull();
  });

  test("a form post to /login with a cookie (a Server Action): not redirected", async () => {
    const result = await run("/login", {
      method: "POST",
      cookie: "better-auth.session_token=abc.def",
      headers: { "next-action": "abc123" },
    });
    expect(result.status).not.toBe(307);
    expect(result.location).toBeNull();
  });

  test("GET /en/services: next-intl still redirects to the clean URL", async () => {
    const result = await run("/en/services");
    expect(result.status).toBe(307);
    expect(result.location).toBe("/services");
  });
});
