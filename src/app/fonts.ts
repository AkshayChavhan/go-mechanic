import { Geist } from "next/font/google";

// One font definition shared by the root layout and the global 404 page.
// shadcn's theme reads the font from --font-sans. Geist is a placeholder;
// task 11 picks the real fonts (including one with Hindi letters).
export const sansFont = Geist({ subsets: ["latin"], variable: "--font-sans" });
