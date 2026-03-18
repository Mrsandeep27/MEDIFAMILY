"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const { user, session, isAuthenticated, setSession, logout } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
  };

  return {
    user,
    session,
    isAuthenticated,
    signOut,
  };
}
