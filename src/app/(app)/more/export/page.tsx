"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/layout/app-header";
import { exportAllData, downloadJSON, downloadCSV } from "@/lib/export/export-data";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const data = await exportAllData();

      if (format === "json") {
        downloadJSON(data);
      } else {
        downloadCSV(data);
      }

      const totalItems =
        data.members.length +
        data.records.length +
        data.medicines.length +
        data.reminders.length;

      toast.success(`Exported ${totalItems} items as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <AppHeader title="Export Data" showBack />

      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Download all your health records and family data. Your data belongs to
          you — export it anytime.
        </p>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => !isExporting && handleExport("json")}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
              <FileJson className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Export as JSON</h3>
              <p className="text-xs text-muted-foreground">
                Complete data export including all records, members, medicines,
                reminders, and health metrics
              </p>
            </div>
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => !isExporting && handleExport("csv")}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Export as CSV</h3>
              <p className="text-xs text-muted-foreground">
                Health records in spreadsheet format — open in Excel or Google
                Sheets
              </p>
            </div>
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What gets exported?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>- All family member profiles</p>
            <p>- Health records (prescriptions, lab reports, etc.)</p>
            <p>- Medicine list and dosage details</p>
            <p>- Reminders and adherence logs</p>
            <p>- Health metrics (BP, sugar, weight, etc.)</p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              Note: Images are not included in the export. Only metadata and
              text data are exported.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
