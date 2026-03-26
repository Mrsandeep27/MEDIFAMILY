"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const { setUser } = useAuthStore();
  const didRun = useRef(false);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || didRun.current) return;
    didRun.current = true;

    const init = async () => {
      const { hasCompletedOnboarding, isAuthenticated } =
        useAuthStore.getState();

      if (isAuthenticated) {
        window.location.href = hasCompletedOnboarding ? "/home" : "/onboarding";
        return;
      }

      try {
        const supabase = createClient();
        const {
          data,
        }: {
          data: {
            session: {
              user: {
                id: string;
                email?: string;
                user_metadata?: Record<string, string>;
              };
            } | null;
          };
        } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || "",
          });
          const onboarded = useAuthStore.getState().hasCompletedOnboarding;
          window.location.href = onboarded ? "/home" : "/onboarding";
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      }
    };

    init();
  }, [hasHydrated, setUser]);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      window.location.href = "/login";
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
