// The proxy's shortcut for pages that need a login (src/proxy.ts): which
// address a request goes to before any page runs, decided from the session
// cookie alone.
//
// It's a shortcut, not the check. The proxy reads no database, so it only
// knows whether a session cookie is there, not whether the session is still
// valid. Every page and every save checks the session itself
// (src/server/auth/access.ts). What the shortcut adds: real 307 redirects.
// A page that reads the session inside <Suspense> has already started
// answering 200 when it finds no session, so it can only redirect in the
// browser.
//
// A leftover cookie (its session deleted, expired, or the local database
// reset) passes the proxy, but the page finds no session and sends the
// visitor to /login?session=ended. The marker tells this shortcut not to
// send them back to /account, which would loop.

/** Pages that need a login: these paths and everything under them. */
export const PROTECTED_PREFIXES = ["/account"] as const;

export const LOGIN_PATH = "/login";
export const ACCOUNT_PATH = "/account";

/** Added to /login by a page that found no session behind a cookie: "?session=ended". */
export const SESSION_ENDED = { name: "session", value: "ended" } as const;

/**
 * Better Auth's session cookie: "__Secure-" in front on HTTPS (staging and
 * production), plain on http://localhost. access-routes.test.ts checks this
 * agrees with Better Auth's own getSessionCookie.
 */
const SESSION_COOKIE_NAMES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

/** Whether a Cookie header holds a non-empty Better Auth session cookie. Checks no signature. */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((pair) => {
    const separator = pair.indexOf("=");
    if (separator === -1) return false;
    const name = pair.slice(0, separator).trim();
    return SESSION_COOKIE_NAMES.includes(name) && pair.slice(separator + 1).trim() !== "";
  });
}

export type AccessRequest = {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  /** Whether a session cookie is present (hasSessionCookie). */
  hasSession: boolean;
};

/**
 * Where to send the request before any page runs, or null to let it
 * through. Only page loads (GET, HEAD) are redirected: a form post (a Server
 * Action) reaches the page it was posted to, logged in or not.
 * - a protected page without a session cookie: to /login;
 * - /login with a session cookie (and no ?session=ended): to /account.
 * The language prefix stays: /hi/account goes to /hi/login; the default
 * language has none (localePrefix "as-needed").
 */
export function accessRedirect(
  request: AccessRequest,
  locales: readonly string[],
  defaultLocale: string,
): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const [, first = "", ...rest] = request.pathname.split("/");
  const hasLocale = locales.includes(first);
  const path = hasLocale ? `/${rest.join("/")}` : request.pathname;
  const prefix = hasLocale && first !== defaultLocale ? `/${first}` : "";

  const isProtected = PROTECTED_PREFIXES.some((protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}/`));
  if (isProtected && !request.hasSession) return `${prefix}${LOGIN_PATH}`;

  const sessionEnded = request.searchParams.get(SESSION_ENDED.name) === SESSION_ENDED.value;
  if (path === LOGIN_PATH && request.hasSession && !sessionEnded) return `${prefix}${ACCOUNT_PATH}`;

  return null;
}
