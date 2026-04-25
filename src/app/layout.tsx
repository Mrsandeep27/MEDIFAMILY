import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Editorial serif used for display headlines (Wellness W2, Family F3, etc).
const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  // 53 chars · contains exact 5-word phrase "Family Health Record App India"
  title: "Family Health Record App India — MediFamily Free",
  // 159 chars · exact phrase appears as the first 5 words
  description:
    "Family health record app India families love. MediFamily stores prescriptions, scans lab reports with AI, sets medicine reminders. Free, offline, Hindi+English.",
  keywords: [
    "family health record app India", "family health record app",
    "MediFamily", "medi family", "family health app india", "health records app",
    "prescription scanner ai", "medicine tracker india", "offline health app",
    "ai doctor app india", "digital health records family", "indian health app",
    "abha health record", "lab report ai", "free health app india",
    "hindi health app", "medicine reminder app",
  ],
  authors: [{ name: "Sandeep Pandey" }],
  creator: "Sandeep Pandey",
  publisher: "MediFamily",
  manifest: "/manifest.json",
  // Icons handled by file-based metadata: src/app/{icon,apple-icon,favicon}.{png,ico}
  // Don't declare explicit icons here — that overrides Next.js's automatic file pickup.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediFamily",
  },
  alternates: {
    canonical: "https://medifamily.in",
  },
  openGraph: {
    title: "Family Health Record App India — MediFamily",
    description: "Family health record app India families trust. MediFamily stores prescriptions, scans lab reports with AI, sets medicine reminders. Free and offline.",
    url: "https://medifamily.in",
    siteName: "MediFamily",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/og-logo.png",
        width: 1200,
        height: 630,
        alt: "MediFamily — Family Health Record App India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Family Health Record App India — MediFamily",
    description: "Family health record app India families trust. Prescriptions, lab reports, medicines — for the whole family. Works offline.",
    images: ["/og-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL("https://medifamily.in"),
  verification: {
    // Add your Google Search Console verification code here once you generate it
    // google: "your-verification-code-here",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* apple-touch-icon handled automatically by src/app/apple-icon.png */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site info" />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
