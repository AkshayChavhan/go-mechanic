import { Inter, Noto_Sans_Devanagari } from "next/font/google";

// The site's fonts, defined once and shared by the root layout and the global
// 404 page. next/font downloads them at build time and serves them from our
// own domain. globals.css builds the font stacks from the two CSS variables:
// San Francisco on Apple devices, then Inter, then Noto Sans Devanagari.
//
// Google's CSS gives every subset (latin, latin-ext, devanagari...) its own
// @font-face rule with a unicode-range, and next/font keeps all of them. The
// browser downloads a file only when the page has a character in its range.
// `subsets` only chooses which files are preloaded in <head>.

// Inter: text on Android and Windows, and the wordmark on every device.
// Preloaded, so it's ready on first paint and text doesn't jump when it loads.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Noto Sans Devanagari: Hindi letters. Not preloaded, so English pages never
// download it (its devanagari subset is listed only to say what it's for).
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  preload: false,
  variable: "--font-devanagari",
});

// Put this on <html>: it defines --font-inter and --font-devanagari.
export const fontVariables = `${inter.variable} ${notoSansDevanagari.variable}`;
