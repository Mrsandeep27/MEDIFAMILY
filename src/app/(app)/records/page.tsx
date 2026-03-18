"use client";

import { FileText } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";

export default function RecordsPage() {
  return (
    <div>
      <AppHeader title="Health Records" />
      <div className="p-4">
        <EmptyState
          icon={FileText}
          title="No records yet"
          description="Add your first health record by scanning a prescription or entering details manually."
          actionLabel="Add Record"
          onAction={() => (window.location.href = "/records/add")}
        />
      </div>
    </div>
  );
}
