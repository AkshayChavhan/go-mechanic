import type { Metadata } from "next";
import "./globals.css";

// Placeholder metadata. Task 42 adds full SEO metadata (title template,
// canonical URL, social image); task 10 moves the layout under [locale].
export const metadata: Metadata = {
  title: "GoMechanic",
  description:
    "GoMechanic is a car and two-wheeler service and repair garage. Our new website is on its way.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
