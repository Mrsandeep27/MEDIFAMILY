"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, hasCompletedOnboarding, setUser } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      if (isAuthenticated) {
        router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
        return;
      }

      // Check server auth
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
            return;
          }
        }
      } catch {
        // Offline — check local state
        if (isAuthenticated) {
          router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
          return;
        }
      }

      router.replace("/login");
    }

    checkAuth();
  }, [router, isAuthenticated, hasCompletedOnboarding, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
