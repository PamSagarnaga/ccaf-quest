import type { Metadata } from "next";
import { fraunces, spaceGrotesk, jetbrainsMono } from "@/lib/fonts";
import { SiteBar } from "@/components/SiteBar";
import { CloudSync } from "@/components/CloudSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Architect's Codex — CCAF Study Quest",
  description:
    "A gamified study companion for the Claude Certified Architect – Foundations exam. Practice, flashcards, and grounded explanations, mapped to the official blueprint.",
};

// Set the theme before paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <SiteBar />
        <CloudSync>{children}</CloudSync>
      </body>
    </html>
  );
}
