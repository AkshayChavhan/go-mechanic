import { homeScreenIcon } from "@/components/admin/home-screen-icon";

// /admin-apple-icon.png: the staff area's icon for an iPhone's home screen
// (task 26), linked from the admin layout's metadata. A full square: iOS
// rounds the corners itself. Reads no request data, so the build draws it once.
export function GET() {
  return homeScreenIcon(180, { rounded: false });
}
