"use client";

import { Share2 } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";

export default function SharedLinksPage() {
  return (
    <div>
      <AppHeader title="Shared Links" showBack />
      <div className="p-4">
        <EmptyState
          icon={Share2}
          title="No shared links"
          description="When you share records with doctors via QR code, your active links will appear here."
        />
      </div>
    </div>
  );
}
