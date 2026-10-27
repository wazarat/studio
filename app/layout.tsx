import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AppClerkProvider } from "@/components/layout/AppClerkProvider";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark is the server class on every route so marketing stays static; the
    // app shell swaps it before paint when a light choice is stored, hence the
    // hydration warning suppression on this one element.
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AppClerkProvider>{children}</AppClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
