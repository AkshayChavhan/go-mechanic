import { homeScreenIcon } from "@/components/admin/home-screen-icon";

// /admin-icon-192.png: the staff area's 192px home-screen icon, listed in
// /admin.webmanifest (task 26). Reads no request data, so the build draws it once.
export function GET() {
  return homeScreenIcon(192, { rounded: true });
}
