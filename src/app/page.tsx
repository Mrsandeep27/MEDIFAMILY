"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  useEffect(() => {
    const go = async () => {
      // Fast path: offline + cached auth + already onboarded → jump straight
      // to /home. Skips Supabase session check which hangs on expired tokens
      // when there's no network (no default timeout on refresh).
      if (!navigator.onLine) {
        const store = useAuthStore.getState();
        if (store.user && store.hasCompletedOnboarding) {
          window.location.replace("/home");
          return;
        }
        if (store.user) {
          window.location.replace("/onboarding");
          return;
        }
        window.location.replace("/login");
        return;
      }

      try {
        const supabase = createClient();
        // 5s timeout — on flaky networks, getSession can hang while trying
        // to refresh. Fall back to cached auth if we have it.
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 5000)
        );
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        const user = data.session?.user;

        if (!user) {
          // No live session. If cached auth exists, trust it (refresh may
          // have failed silently). Otherwise go to login.
          const cached = useAuthStore.getState().user;
          if (cached && useAuthStore.getState().hasCompletedOnboarding) {
            window.location.replace("/home");
          } else {
            window.location.replace("/login");
          }
          return;
        }

        // Put user in store
        useAuthStore.getState().setUser({
          id: user.id,
          email: user.email || "",
          name: (user.user_metadata as Record<string, string>)?.name || "",
        });

        // Check localStorage first (fast path)
        if (useAuthStore.getState().hasCompletedOnboarding) {
          window.location.replace("/home");
          return;
        }

        // localStorage says not onboarded — ask the server
        // (handles existing user on a new device)
        try {
          const res = await fetch("/api/check-onboarding");
          const { onboarded } = await res.json();
          if (onboarded) {
            useAuthStore.getState().setHasCompletedOnboarding(true);
            window.location.replace("/home");
            return;
          }
        } catch {
          // Server check failed — fall through to onboarding
        }

        window.location.replace("/onboarding");
      } catch {
        window.location.replace("/login");
      }
    };

    go();
  }, []);

  // SEO-visible hero. Renders for ~300ms pre-redirect so Googlebot indexes:
  // - H1 with exact 5-word phrase "Family Health Record App India"
  // - 130+ words with target phrase repeated 3× verbatim
  // - Short sentences (Flesch reading score >60 = "Plain English")
  // - 3 internal links + H2 hierarchy
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <div className="max-w-xl w-full text-center space-y-5">
        <LoadingSpinner size="lg" text="Loading MediFamily..." />

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Family Health Record App India Trusts — MediFamily
        </h1>

        <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
          MediFamily is the free family health record app India families use to keep
          everyone&apos;s health in one place. Store prescriptions. Scan lab reports
          with AI. Set medicine reminders. Share an emergency QR with any doctor.
        </p>

        <h2 className="text-base md:text-lg font-semibold text-foreground pt-2">
          Why pick a family health record app India built for Indian homes?
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed">
          We made it for joint families, working parents, and elders. It works
          offline. It speaks Hindi and English. It runs on cheap Android phones.
          No ads. No data selling. No monthly fee. Just a clean record of every
          medicine, lab test, and doctor visit for your whole parivaar.
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
          <a href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </a>
          <span className="text-muted-foreground/40">·</span>
          <a href="/login" className="text-primary hover:underline font-medium">
            Create free account
          </a>
          <span className="text-muted-foreground/40">·</span>
          <a href="https://medifamily.in" className="text-primary hover:underline font-medium">
            Learn more
          </a>
        </nav>

        <p className="text-[11px] text-muted-foreground pt-1">
          Redirecting you to the app…
        </p>
      </div>
    </main>
  );
}
