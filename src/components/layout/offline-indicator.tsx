"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

export function OfflineIndicator() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-1.5">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You&apos;re offline. Changes will sync when you&apos;re back online.</span>
    </div>
  );
}
