import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { cn } from "@/lib/utils";
import "./globals.css";

// shadcn's theme reads the font from --font-sans. Geist is a placeholder;
// task 11 picks the real fonts.
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// Placeholder metadata. Task 42 adds full SEO metadata (title template,
// canonical URL, social image); task 10 moves the layout under [locale].
export const metadata: Metadata = {
  title: "GoMechanic",
  description:
    "GoMechanic is a car and two-wheeler service and repair garage. Our new website is on its way.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
