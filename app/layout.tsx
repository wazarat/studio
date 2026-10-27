import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AppClerkProvider } from "@/components/layout/AppClerkProvider";
import { Background } from "@/components/layout/Background";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { THEME_COLOR } from "@/lib/theme-constants";
import { SITE } from "@/content/site";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const SHARE_TITLE = `${SITE.name} · ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  // Browser tabs show only the site name; share cards keep the descriptive title.
  title: SITE.name,
  description: SITE.description,
  openGraph: {
    title: SHARE_TITLE,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SITE.description,
  },
  keywords: [
    "tokenization",
    "stablecoins",
    "defi",
    "crypto research",
    "capital markets",
    "canhav",
  ],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.dark,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark only for now. The light palette is still defined in globals.css
    // (html.light) for a later step; nothing switches to it yet.
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable} dark`}>
      <body className="min-h-screen antialiased">
        <AppClerkProvider>
          <Background />
          <div className="relative flex min-h-screen flex-col">
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AppClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
