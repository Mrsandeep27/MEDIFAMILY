"use client";

import { Bell } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";

export default function RemindersPage() {
  return (
    <div>
      <AppHeader title="Reminders" />
      <div className="p-4">
        <EmptyState
          icon={Bell}
          title="No reminders yet"
          description="Medicine reminders will appear here once you scan a prescription or add them manually."
        />
      </div>
    </div>
  );
}
