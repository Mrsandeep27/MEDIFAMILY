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
  title: "MediFamily — Your Whole Family's Health, In Your Pocket | Free Offline App",
  description:
    "Free family health app that works without internet. Store prescriptions, track medicines, manage lab reports for parents, kids & grandparents in one app. Made for Indian families.",
  keywords: [
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
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediFamily",
  },
  alternates: {
    canonical: "https://medifamily.in",
  },
  openGraph: {
    title: "MediFamily — Your Whole Family's Health, In Your Pocket",
    description: "Free family health app that works without internet. Prescriptions, medicines, lab reports for your entire family. Made for India.",
    url: "https://medifamily.in",
    siteName: "MediFamily",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "MediFamily — Your Whole Family's Health, In Your Pocket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediFamily — Your Whole Family's Health, In Your Pocket",
    description: "Free family health app that works without internet. Prescriptions, medicines, lab reports for your entire family. Made for India.",
    images: ["/logo.png"],
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
        <link rel="apple-touch-icon" href="/logo.png" />
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
