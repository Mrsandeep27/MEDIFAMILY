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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediFamily..." />
    </div>
  );
}
