import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";

// Display serif — characterful, high-contrast. Used for headings & hero numerals.
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// UI sans — geometric with personality. Body & interface.
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Mono — task codes (1.1), scores, XP, anything tabular/technical.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
