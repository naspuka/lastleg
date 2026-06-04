import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

// Pick the right absolute base for OG / canonical URLs:
// - Production: Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the stable
//   project URL (e.g. lastleg-azure.vercel.app or the custom domain once we
//   register one).
// - Preview deploys: VERCEL_URL points to the per-deploy URL so previews share
//   correctly.
// - Local dev: fall back to localhost:4000.
// Once we own a custom domain, hard-code it here and drop the env logic.
const metadataBaseUrl = (() => {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;
  return "http://localhost:4000";
})();

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: "LastLeg — Don't waste your unused coach ticket",
    template: "%s · LastLeg",
  },
  description:
    "A marketplace for last-minute UK coach tickets you can't use. Sellers recoup something, buyers get a discount, no scalping.",
  openGraph: {
    type: "website",
    siteName: "LastLeg",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
