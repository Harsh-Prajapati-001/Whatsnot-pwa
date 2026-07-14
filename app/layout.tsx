import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Whatsnot", template: "%s | Whatsnot" },
  description: "Learn, set up and manage clear WhatsApp business notifications without confusing infrastructure jargon.",
  applicationName: "Whatsnot",
  metadataBase: new URL("https://whatsnot-pwa.harshprajapati0756.workers.dev"),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Whatsnot — Business updates, delivered automatically",
    description: "Guided WhatsApp notification systems with transparent one-time setup costs.",
    type: "website",
    images: [{ url: "/og.png", width: 1713, height: 911, alt: "Whatsnot business notification journey" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Whatsnot — Business updates, delivered automatically",
    description: "Guided WhatsApp notification systems with transparent one-time setup costs.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Whatsnot" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4F46E5",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
