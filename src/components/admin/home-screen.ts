// The addresses behind "Add to home screen" for the staff area (task 26,
// R10). The manifest and the admin layout's metadata both point at them.
// Each one is a Route Handler under src/app/ with the same folder name; they
// end in .png or .webmanifest, so the proxy skips them (src/proxy.ts) and a
// browser's cookie-less fetch of them is never sent to /login.

export const ADMIN_MANIFEST_PATH = "/admin.webmanifest";

export const HOME_SCREEN_ICONS = {
  192: "/admin-icon-192.png",
  512: "/admin-icon-512.png",
  /** iOS's apple-touch-icon: 180px, the size current iPhones use. */
  apple: "/admin-apple-icon.png",
} as const;
