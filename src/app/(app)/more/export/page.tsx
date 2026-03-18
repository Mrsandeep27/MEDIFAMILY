"use client";

import { Download } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ExportPage() {
  return (
    <div>
      <AppHeader title="Export Data" showBack />
      <div className="p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Coming in Phase 6</h2>
            <p className="text-sm text-muted-foreground">
              Export all your health records as a ZIP file with JSON data and images.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
