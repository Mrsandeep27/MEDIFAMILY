import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · MediFamily",
  description:
    "You're offline. MediFamily works without internet — open the app to view your records.",
  robots: { index: false, follow: false },
};

// Branded offline fallback. Served by the service worker when a navigation
// request fails AND the requested route isn't in the cache. Avoids Chrome's
// dino-on-supabase.co error page when an unauth'd user opens the app cold
// while offline.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            aria-hidden="true"
          >
            <path d="M12 20h.01" />
            <path d="M2 8.82a15 15 0 0 1 20 0" />
            <path d="M5 12.859a10 10 0 0 1 14 0" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <line x1="2" x2="22" y1="2" y2="22" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          MediFamily works without internet for your saved records. But signing
          in and syncing new data needs a connection.
        </p>

        <div className="grid gap-2 pt-2 text-left text-sm">
          <div className="rounded-lg border border-border/40 bg-card p-3">
            <p className="font-semibold">Already signed in?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Open the app from your home screen — your records are stored on
              this device.
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-card p-3">
            <p className="font-semibold">First time here?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reconnect to the internet. Sign-in needs Wi-Fi or mobile data
              for the first session only.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-center pt-3">
          <a
            href="/home"
            className="inline-flex items-center justify-center px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Go to App
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-4 h-10 rounded-lg border border-border text-sm font-semibold"
          >
            Sign in
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground pt-4">
          MediFamily · India&apos;s family health record app · works offline
        </p>
      </div>
    </main>
  );
}
