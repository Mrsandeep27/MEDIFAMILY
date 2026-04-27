"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, FlaskConical, Pencil, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { RecordForm } from "@/components/records/record-form";
import { useRecords } from "@/hooks/use-records";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

// Single entry point for adding a record. Tab 1 is the manual form
// (legacy /records/add behaviour preserved). Tabs 2 and 3 surface the
// AI scanners that previously lived as separate top-level routes —
// users on /records → "+" no longer miss them.
export default function AddRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMemberId = searchParams.get("memberId") || undefined;
  const { addRecord } = useRecords();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: Parameters<typeof addRecord>[0], images: File[]) => {
    setIsSubmitting(true);
    try {
      await addRecord(data, images);
      toast.success("Record added successfully");
      router.push("/records");
    } catch (err) {
      toast.error("Failed to add record");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member context, when present, flows through to the AI scanners so
  // they can pre-select the right member instead of forcing a re-pick.
  const memberQS = defaultMemberId ? `?memberId=${defaultMemberId}` : "";

  return (
    <div>
      <AppHeader title="Add Record" showBack />
      <div className="p-4">
        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />Manual
            </TabsTrigger>
            <TabsTrigger value="prescription">
              <ScanLine className="h-3.5 w-3.5 mr-1.5" />Scan Rx
            </TabsTrigger>
            <TabsTrigger value="lab">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />Scan Lab
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="pt-4">
            <RecordForm
              defaultMemberId={defaultMemberId}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </TabsContent>

          <TabsContent value="prescription" className="pt-4">
            <ScannerCard
              icon={ScanLine}
              title="Scan Prescription"
              description="Take a photo of a prescription. AI reads the medicines, dosage, and frequency — and creates reminders automatically."
              cta="Open Scanner"
              href={`/scan${memberQS}`}
            />
          </TabsContent>

          <TabsContent value="lab" className="pt-4">
            <ScannerCard
              icon={FlaskConical}
              title="Scan Lab Report"
              description="Upload a lab PDF or photo. AI extracts every marker, flags abnormal values, and explains what they mean in plain language."
              cta="Open Scanner"
              href={`/lab-insights${memberQS}`}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ScannerCard({
  icon: Icon,
  title,
  description,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta: string;
  href: string;
}) {
  return (
    <Card className="cursor-pointer hover:border-primary transition-colors">
      <Link href={href}>
        <CardContent className="flex flex-col items-center text-center py-10 gap-3">
          <div className="rounded-full bg-primary/10 p-5">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
          <div className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-2">
            {cta}
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
