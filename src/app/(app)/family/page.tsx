"use client";

import Link from "next/link";
import { Plus, Users, UserPlus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/layout/app-header";
import { MemberCard } from "@/components/family/member-card";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMembers } from "@/hooks/use-members";
import { useLocale } from "@/lib/i18n/use-locale";
import { db } from "@/lib/db/dexie";
import type { HealthRecord } from "@/lib/db/schema";

export default function FamilyPage() {
  const { members, isLoading } = useMembers();
  const { t } = useLocale();

  const allRecords = useLiveQuery(
    () => db.records.filter((r) => !r.is_deleted).toArray(),
    []
  );

  // Per-member stats
  const memberStats = (() => {
    if (!allRecords) return {};
    const map: Record<string, { latest: HealthRecord | null; count: number }> = {};
    for (const r of allRecords) {
      if (!map[r.member_id]) map[r.member_id] = { latest: null, count: 0 };
      map[r.member_id].count++;
      const current = map[r.member_id].latest;
      if (!current || (r.visit_date || r.created_at) > (current.visit_date || current.created_at)) {
        map[r.member_id].latest = r;
      }
    }
    return map;
  })();

  return (
    <div>
      <AppHeader
        title={t("family.title")}
        rightAction={
          <Link href="/family/add">
            <button className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform">
              <Plus className="h-3.5 w-3.5" />
              {t("family.add")}
            </button>
          </Link>
        }
      />

      <div className="p-4">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : members.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-muted/60 flex items-center justify-center mb-5">
              <Users className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-lg font-bold">{t("family.no_members")}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[250px]">
              {t("family.no_members_desc")}
            </p>
            <Link href="/family/add">
              <button className="mt-6 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-transform">
                <UserPlus className="h-4 w-4" />
                {t("family.add_member")}
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Member count */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>

            {members.map((member) => {
              const stats = memberStats[member.id];
              return (
                <MemberCard
                  key={member.id}
                  member={member}
                  latestRecord={stats?.latest ?? null}
                  recordCount={stats?.count ?? 0}
                />
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
