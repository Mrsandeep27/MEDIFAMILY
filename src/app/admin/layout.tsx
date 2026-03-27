import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "MediLog Admin",
  description: "Admin dashboard for MediLog",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MediLog Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
