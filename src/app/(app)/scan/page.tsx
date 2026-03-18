"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine } from "lucide-react";

export default function ScanPage() {
  return (
    <div>
      <AppHeader title="Scan Prescription" showBack />
      <div className="p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <ScanLine className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Coming in Phase 3</h2>
            <p className="text-sm text-muted-foreground">
              AI-powered prescription scanner with camera capture, OCR, and
              Claude API extraction.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
