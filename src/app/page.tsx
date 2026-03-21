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

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const init = async () => {
      const { hasCompletedOnboarding, isAuthenticated } = useAuthStore.getState();
      const supabase = createClient();

      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: (user.user_metadata as Record<string, string>)?.name || "",
          });
          router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
        } else if (isAuthenticated && hasCompletedOnboarding) {
          router.replace("/home");
        } else {
          router.replace("/login");
        }
      } catch {
        const { hasCompletedOnboarding: hco, isAuthenticated: ia } = useAuthStore.getState();
        router.replace(ia && hco ? "/home" : "/login");
      }
    };

    init();
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
