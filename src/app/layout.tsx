import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediFamily — AI Health Record Manager for Indian Families | Free PWA",
  description:
    "Free offline-first family health app. Scan prescriptions with AI, track medicines, store lab reports, ask AI doctor in Hindi/English. Works without internet. Made for Indian families.",
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
    title: "MediFamily — AI Health Record Manager for Indian Families",
    description: "Free offline-first family health app with AI doctor, prescription scanner, medicine reminders, and lab insights. Made for India.",
    url: "https://medifamily.in",
    siteName: "MediFamily",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "MediFamily — AI Family Health Record Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediFamily — AI Health Record Manager for Indian Families",
    description: "Free offline-first family health app with AI doctor, prescription scanner, medicine reminders.",
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
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
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
