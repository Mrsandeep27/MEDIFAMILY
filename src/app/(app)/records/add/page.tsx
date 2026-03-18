"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AddRecordPage() {
  return (
    <div>
      <AppHeader title="Add Record" showBack />
      <div className="p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Coming in Phase 2</h2>
            <p className="text-sm text-muted-foreground">
              Manual record entry with photo attachments, tags, and full-text search.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
