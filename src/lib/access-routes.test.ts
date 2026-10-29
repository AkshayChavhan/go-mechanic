import { getSessionCookie } from "better-auth/cookies";
import { describe, expect, test } from "vitest";

import { accessRedirect, hasSessionCookie } from "./access-routes";

// The proxy's decision, as a pure function: which address a request is sent
// to before any page runs, or null to let it through. Locales "en" (the
// default, no prefix in URLs) and "hi" (prefixed), so Hindi is covered now.
const locales = ["en", "hi"] as const;

function decide(method: string, url: string, hasSession: boolean): string | null {
  const { pathname, searchParams } = new URL(url, "http://localhost");
  return accessRedirect({ method, pathname, searchParams, hasSession }, locales, "en");
}

describe("accessRedirect (the proxy's shortcut, by the session cookie alone)", () => {
  test.each(["/account", "/account/vehicles", "/en/account"])("GET %s, logged out: to /login", (path) => {
    expect(decide("GET", path, false)).toBe("/login");
  });

  test("GET /hi/account, logged out: to /hi/login (the language stays)", () => {
    expect(decide("GET", "/hi/account", false)).toBe("/hi/login");
  });

  test("HEAD /account, logged out: to /login", () => {
    expect(decide("HEAD", "/account", false)).toBe("/login");
  });

  test("GET /account, with a session cookie: through (the page checks the session itself)", () => {
    expect(decide("GET", "/account", true)).toBeNull();
  });

  test("GET /login, with a session cookie: to /account; /hi/login to /hi/account", () => {
    expect(decide("GET", "/login", true)).toBe("/account");
    expect(decide("GET", "/hi/login", true)).toBe("/hi/account");
  });

  test("GET /login?session=ended, with a cookie: through (a leftover cookie can't loop)", () => {
    expect(decide("GET", "/login?session=ended", true)).toBeNull();
  });

  test("GET /login, logged out: through", () => {
    expect(decide("GET", "/login", false)).toBeNull();
  });

  test("form posts are never redirected: POST /login with a cookie, POST /account without", () => {
    expect(decide("POST", "/login", true)).toBeNull();
    expect(decide("POST", "/account", false)).toBeNull();
  });

  test("percent-encoded paths count as what they spell: /%61ccount and /%6Cogin", () => {
    expect(decide("GET", "/%61ccount", false)).toBe("/login");
    expect(decide("GET", "/%6Cogin", true)).toBe("/account");
  });

  test("a malformed address doesn't throw: let through", () => {
    expect(decide("GET", "/%E0%A4%A", false)).toBeNull();
  });

  test.each(["/accounting", "/account-help", "/services", "/", "/hi", "/login/extra"])(
    "GET %s: through, logged in or out",
    (path) => {
      expect(decide("GET", path, false)).toBeNull();
      expect(decide("GET", path, true)).toBeNull();
    },
  );
});

describe("hasSessionCookie (is a Better Auth session cookie present?)", () => {
  test.each([
    ["no cookie header", null, false],
    ["the cookie on http://localhost", "better-auth.session_token=abc.def", true],
    ["the cookie on https (__Secure- prefix)", "__Secure-better-auth.session_token=abc.def", true],
    ["among other cookies", "theme=dark; better-auth.session_token=abc.def; x=1", true],
    ["an empty value", "better-auth.session_token=", false],
    ["another cookie only", "better-auth.dont_remember=true", false],
    ["a look-alike name", "my-better-auth.session_token=abc", false],
  ])("%s", (_case, header, expected) => {
    expect(hasSessionCookie(header)).toBe(expected);
  });

  test("agrees with Better Auth's own getSessionCookie, so a renamed cookie fails here", () => {
    const headers = [
      "better-auth.session_token=abc.def",
      "__Secure-better-auth.session_token=abc.def",
      "theme=dark; better-auth.session_token=abc.def",
      "better-auth.session_token=",
      "better-auth.dont_remember=true",
      "x=1",
    ];
    for (const header of headers) {
      expect(hasSessionCookie(header), header).toBe(getSessionCookie(new Headers({ cookie: header })) !== null);
    }
  });
});
