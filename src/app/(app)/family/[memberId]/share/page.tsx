"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function SharePage() {
  return (
    <div>
      <AppHeader title="Share with Doctor" showBack />
      <div className="p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Coming in Phase 5</h2>
            <p className="text-sm text-muted-foreground">
              Generate QR codes to securely share health records with doctors.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
