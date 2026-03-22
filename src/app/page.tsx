"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const didRun = useRef(false);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    // Wait for Zustand to hydrate first
    if (!hasHydrated || didRun.current) return;
    didRun.current = true;

    const init = async () => {
      const { hasCompletedOnboarding, isAuthenticated } = useAuthStore.getState();

      // If already authenticated in Zustand, redirect immediately (no API call)
      if (isAuthenticated && hasCompletedOnboarding) {
        router.replace("/home");
        return;
      }

      // Otherwise check Supabase session
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: (user.user_metadata as Record<string, string>)?.name || "",
          });
          router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace(isAuthenticated ? "/home" : "/login");
      }
    };

    init();
  }, [hasHydrated, router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
