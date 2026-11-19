import { homeScreenIcon } from "@/components/admin/home-screen-icon";

// /admin-icon-512.png: the staff area's 512px home-screen icon, listed in
// /admin.webmanifest (task 26). Reads no request data, so the build draws it once.
export function GET() {
  return homeScreenIcon(512, { rounded: true });
}
