"use client";

import Link from "next/link";
import { ChevronRight, FileText, TestTube, Syringe, Receipt, Hospital, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import type { HealthRecord } from "@/lib/db/schema";

const TYPE_ICONS: Record<string, React.ElementType> = {
  prescription: FileText,
  lab_report: TestTube,
  vaccination: Syringe,
  bill: Receipt,
  discharge_summary: Hospital,
  other: File,
};

const TYPE_COLORS: Record<string, string> = {
  prescription: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  lab_report: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  vaccination: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  bill: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  discharge_summary: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

interface RecordCardProps {
  record: HealthRecord;
  memberName?: string;
}

export function RecordCard({ record, memberName }: RecordCardProps) {
  const Icon = TYPE_ICONS[record.type] || File;
  const colorClass = TYPE_COLORS[record.type] || TYPE_COLORS.other;
  const date = record.visit_date
    ? new Date(record.visit_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/records/${record.id}`}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`rounded-lg p-2.5 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{record.title}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {RECORD_TYPE_LABELS[record.type]}
              </span>
              {date && (
                <span className="text-xs text-muted-foreground">{date}</span>
              )}
            </div>
            {(record.doctor_name || memberName) && (
              <div className="flex items-center gap-2 mt-0.5">
                {record.doctor_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    Dr. {record.doctor_name}
                  </span>
                )}
                {memberName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {memberName}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {record.image_urls.length > 0 && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {record.image_urls.length} img
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
