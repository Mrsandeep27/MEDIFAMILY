"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const { user, isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            return;
          }
        }
        setUser(null);
      } catch {
        // Offline — keep existing state
      }
    }

    if (!user) {
      checkAuth();
    }
  }, [user, setUser]);

  return {
    user,
    isAuthenticated,
  };
}
