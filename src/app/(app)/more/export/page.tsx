"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/layout/app-header";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useMedicines } from "@/hooks/use-medicines";
import { useReminders } from "@/hooks/use-reminders";
import { RECORD_TYPE_LABELS, FREQUENCY_LABELS } from "@/constants/config";

export default function ExportPage() {
  const { members } = useMembers();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { records } = useRecords(selectedMemberId || undefined);
  const { medicines } = useMedicines(selectedMemberId || undefined);
  const { reminders } = useReminders(selectedMemberId || undefined);
  const [isExporting, setIsExporting] = useState(false);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const activeMeds = medicines.filter((m) => m.is_active);

  const handleExportPDF = () => {
    if (!selectedMember) {
      toast.error("Please select a family member");
      return;
    }

    setIsExporting(true);
    try {
      const html = buildDetailedPDF(selectedMember, records, activeMeds, reminders);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
        toast.success("PDF report generated! Use Print → Save as PDF");
      } else {
        toast.error("Pop-up blocked. Allow pop-ups for this site.");
      }
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = () => {
    setIsExporting(true);
    try {
      const html = buildFullFamilyPDF(members, records, medicines, reminders);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
        toast.success("Full family report generated!");
      } else {
        toast.error("Pop-up blocked. Allow pop-ups for this site.");
      }
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <AppHeader title="Export Health Report" showBack />
      <div className="p-4 space-y-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Generate a detailed PDF health report. Show it to your doctor,
              keep it for records, or share with family members.
            </p>
          </CardContent>
        </Card>

        {/* Single Member Export */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Individual Report</h3>
            </div>

            <div className="space-y-2">
              <Label>Select Family Member</Label>
              <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMember && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg space-y-0.5">
                <p>Records: {records.length} | Medicines: {activeMeds.length} | Reminders: {reminders.length}</p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleExportPDF}
              disabled={!selectedMemberId || isExporting}
            >
              {isExporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Download PDF Report</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Full Family Export */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Full Family Report</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              All {members.length} family members with their records, medicines, and reminders in one PDF.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportAll}
              disabled={members.length === 0 || isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Full Family PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <h4 className="text-sm font-medium mb-2">What&apos;s included:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Patient profile (DOB, blood group, gender, allergies)</li>
              <li>• Emergency contacts</li>
              <li>• Chronic conditions highlighted</li>
              <li>• All health records with doctor, hospital, diagnosis</li>
              <li>• Current medicines with dosage and schedule</li>
              <li>• Active reminders with timing</li>
              <li>• Report date and MediFamily branding</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ========== PDF BUILDERS ==========

interface MemberData {
  name: string;
  relation: string;
  date_of_birth?: string;
  gender: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

interface RecordData {
  title: string;
  type: string;
  visit_date?: string;
  doctor_name?: string;
  hospital_name?: string;
  diagnosis?: string;
  notes?: string;
}

interface MedicineData {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  before_food: boolean;
}

interface ReminderData {
  medicine_name: string;
  member_name: string;
  time: string;
  dosage?: string;
  before_food: boolean;
  days: string[];
  is_active: boolean;
}

const CSS = `
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 750px; margin: 0 auto; padding: 20px; color: #222; font-size: 12px; line-height: 1.5; }
  .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { color: #16a34a; margin: 0; font-size: 22px; }
  .header p { color: #666; margin: 3px 0; font-size: 11px; }
  .section { margin-bottom: 18px; page-break-inside: avoid; }
  .section h2 { font-size: 14px; color: #16a34a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; margin: 0 0 8px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .field { display: flex; gap: 6px; font-size: 12px; }
  .field .label { color: #888; min-width: 110px; }
  .field .val { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
  th { background: #f5f5f5; text-align: left; padding: 5px 8px; border: 1px solid #ddd; font-weight: 600; }
  td { padding: 5px 8px; border: 1px solid #ddd; }
  .alert { background: #fef2f2; border: 1px solid #fca5a5; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
  .alert b { color: #dc2626; }
  .chronic { background: #fff7ed; border: 1px solid #fed7aa; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
  .chronic b { color: #ea580c; }
  .footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; color: #999; font-size: 9px; }
  .page-break { page-break-before: always; }
  @media print { body { font-size: 10px; } }
`;

function memberSection(m: MemberData, records: RecordData[], meds: MedicineData[], rems: ReminderData[]): string {
  const now = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const age = m.date_of_birth ? Math.floor((Date.now() - new Date(m.date_of_birth).getTime()) / 31557600000) : null;

  return `
<div class="section">
  <h2>👤 Patient Information</h2>
  <div class="grid">
    <div class="field"><span class="label">Name:</span><span class="val">${m.name}</span></div>
    <div class="field"><span class="label">Blood Group:</span><span class="val">${m.blood_group || "N/A"}</span></div>
    <div class="field"><span class="label">Date of Birth:</span><span class="val">${m.date_of_birth || "N/A"}${age ? ` (${age} yrs)` : ""}</span></div>
    <div class="field"><span class="label">Gender:</span><span class="val">${m.gender || "N/A"}</span></div>
    <div class="field"><span class="label">Relation:</span><span class="val">${m.relation}</span></div>
    <div class="field"><span class="label">Report Date:</span><span class="val">${now}</span></div>
  </div>
  ${m.emergency_contact_name ? `<div class="field" style="margin-top:6px;"><span class="label">Emergency Contact:</span><span class="val">${m.emergency_contact_name} — ${m.emergency_contact_phone || "N/A"}</span></div>` : ""}
</div>

${m.allergies.length > 0 ? `<div class="alert"><b>⚠ Known Allergies:</b> ${m.allergies.join(", ")}</div>` : ""}
${m.chronic_conditions.length > 0 ? `<div class="chronic"><b>🏥 Chronic Conditions:</b> ${m.chronic_conditions.join(", ")}</div>` : ""}

<div class="section">
  <h2>💊 Current Medicines (${meds.length})</h2>
  ${meds.length > 0 ? `
  <table>
    <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Timing</th></tr>
    ${meds.map((med) => `<tr>
      <td><b>${med.name}</b></td>
      <td>${med.dosage || "—"}</td>
      <td>${med.frequency ? (FREQUENCY_LABELS[med.frequency] || med.frequency) : "—"}</td>
      <td>${med.duration || "—"}</td>
      <td>${med.before_food ? "Before food" : "After food"}</td>
    </tr>`).join("")}
  </table>` : "<p style='color:#888;'>No active medicines</p>"}
</div>

<div class="section">
  <h2>📋 Health Records (${records.length})</h2>
  ${records.length > 0 ? `
  <table>
    <tr><th>Date</th><th>Title</th><th>Type</th><th>Doctor</th><th>Hospital</th><th>Diagnosis</th></tr>
    ${records.map((r) => `<tr>
      <td>${r.visit_date || "—"}</td>
      <td><b>${r.title}</b></td>
      <td>${RECORD_TYPE_LABELS[r.type] || r.type}</td>
      <td>${r.doctor_name || "—"}</td>
      <td>${r.hospital_name || "—"}</td>
      <td>${r.diagnosis || "—"}</td>
    </tr>`).join("")}
  </table>
  ${records.filter((r) => r.notes).map((r) => `<p style="font-size:10px;color:#666;margin:4px 0;">📝 ${r.title}: ${r.notes}</p>`).join("")}
  ` : "<p style='color:#888;'>No records available</p>"}
</div>

${rems.length > 0 ? `
<div class="section">
  <h2>⏰ Active Reminders (${rems.filter((r) => r.is_active).length})</h2>
  <table>
    <tr><th>Medicine</th><th>Time</th><th>Dosage</th><th>Days</th><th>Timing</th></tr>
    ${rems.filter((r) => r.is_active).map((r) => `<tr>
      <td>${r.medicine_name}</td>
      <td><b>${r.time}</b></td>
      <td>${r.dosage || "—"}</td>
      <td>${r.days.join(", ").toUpperCase()}</td>
      <td>${r.before_food ? "Before food" : "After food"}</td>
    </tr>`).join("")}
  </table>
</div>` : ""}`;
}

function buildDetailedPDF(m: MemberData, records: RecordData[], meds: MedicineData[], rems: ReminderData[]): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MediFamily Report — ${m.name}</title><style>${CSS}</style></head><body>
<div class="header"><h1>MediFamily Health Report</h1><p>Comprehensive health summary</p><p style="font-size:9px;">This report is for informational purposes only</p></div>
${memberSection(m, records, meds, rems)}
<div class="footer"><p>Generated by MediFamily — India's Family Health Record Manager | medi--log.vercel.app</p></div>
</body></html>`;
}

function buildFullFamilyPDF(
  allMembers: MemberData[],
  allRecords: RecordData[],
  allMeds: MedicineData[],
  allRems: ReminderData[]
): string {
  const sections = allMembers.map((m, i) => {
    return `${i > 0 ? '<div class="page-break"></div>' : ""}${memberSection(m, allRecords, allMeds, allRems)}`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MediFamily Family Report</title><style>${CSS}</style></head><body>
<div class="header"><h1>MediFamily Family Health Report</h1><p>${allMembers.length} family members</p><p style="font-size:9px;">This report is for informational purposes only</p></div>
${sections}
<div class="footer"><p>Generated by MediFamily — India's Family Health Record Manager | medi--log.vercel.app</p></div>
</body></html>`;
}
