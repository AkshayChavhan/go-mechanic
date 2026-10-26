import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";

import messages from "../../messages/en.json";

import { GARAGE_TIME_ZONE, type Locale } from "./config";

// src/i18n/request.ts picks the language for each request. These tests swap
// out two modules it imports:
// - next/root-params: the URL's [locale] segment. The real module only works
//   inside a Next.js render; here each test says what it returns.
// - next-intl/server: under React Server Components, getRequestConfig just
//   returns the function it's given. Tests don't run there, and the version
//   they'd load throws "not supported", so it's replaced by that same identity.
const rootParams = vi.hoisted(() => ({ locale: vi.fn<() => Promise<string>>() }));
vi.mock("next/root-params", () => ({ locale: rootParams.locale }));
vi.mock("next-intl/server", () => ({ getRequestConfig: <T>(create: T) => create }));

const { default: requestConfig } = await import("./request");

/** Runs request.ts like next-intl does, with an optional explicit locale. */
function configFor(explicitLocale?: Locale) {
  return requestConfig({ locale: explicitLocale, requestLocale: Promise.resolve(undefined) });
}

/** What notFound() throws: Next.js shows the 404 page when it catches it. */
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(() => {
  rootParams.locale.mockReset();
});

describe("request.ts (which language each request uses)", () => {
  test("an explicit locale is used as is, without reading the URL", async () => {
    const config = await configFor("en");
    expect(config.locale).toBe("en");
    expect(rootParams.locale).not.toHaveBeenCalled();
  });

  test("pages under [locale] get the language from the URL", async () => {
    rootParams.locale.mockResolvedValue("en");
    expect((await configFor()).locale).toBe("en");
  });

  test("no locale in the URL (the global 404 in a production build): the default language", async () => {
    // Outside [locale], Next.js has no such root param and returns nothing.
    rootParams.locale.mockResolvedValue(undefined as unknown as string);
    expect((await configFor()).locale).toBe("en");
  });

  test("the root param rejects (the global 404 under next dev): the default language", async () => {
    rootParams.locale.mockRejectedValue(new Error('Route "/_not-found" accessed root param "locale" which is not defined'));
    expect((await configFor()).locale).toBe("en");
  });

  test("an unknown locale in the URL is a 404, not a page in the wrong language", async () => {
    // "/foo.png" can reach [locale] with "foo.png" as the locale.
    rootParams.locale.mockResolvedValue("foo.png");
    await expect(configFor()).rejects.toMatchObject({ digest: NOT_FOUND });
  });

  test("Next.js's own signals from the root param are passed on, not swallowed", async () => {
    let signal: unknown;
    try {
      notFound();
    } catch (error) {
      signal = error;
    }
    rootParams.locale.mockRejectedValue(signal);
    await expect(configFor()).rejects.toBe(signal);
  });

  test("loads the language's messages and uses India time", async () => {
    rootParams.locale.mockResolvedValue("en");
    const config = await configFor();
    expect(config.messages).toEqual(messages);
    expect(config.timeZone).toBe(GARAGE_TIME_ZONE);
  });
});
