"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

// Global flag — only one auth listener across the entire app
let authInitialized = false;

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore();
  const didInit = useRef(false);

  useEffect(() => {
    // Skip if already initialized globally or in this instance
    if (authInitialized || didInit.current) return;
    didInit.current = true;
    authInitialized = true;

    const supabase = createClient();

    // Only call getSession if Zustand doesn't already have a user (skip redundant API call)
    const zustandUser = useAuthStore.getState().user;
    if (!zustandUser) {
      supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; phone?: string } } | null } }) => {
        const u = data.session?.user;
        if (u) {
          setUser({
            id: u.id,
            email: u.email || "",
            name: (u.user_metadata as Record<string, string>)?.name || "",
            phone: u.phone || "",
          });
        }
      }).catch(() => {});
    }

    // One listener for auth state changes (login/logout/token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; phone?: string } } | null) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "",
          phone: session.user.phone || "",
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      authInitialized = false;
    };
  }, [setUser]);

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      authInitialized = false;
      logout();
    }
  };

  return {
    user,
    isAuthenticated,
    signOut,
  };
}
