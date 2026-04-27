"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Settings was inlined into /more — this file remains only to handle deep
// links (notifications, badges, old bookmarks) that still point at
// /more/settings. Bounce them up to the new location.
export default function SettingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/more");
  }, [router]);
  return null;
}
