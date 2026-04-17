import { db } from "./dexie";

/**
 * One-time cleanup: if the current user has multiple `relation === "self"`
 * members (a legacy bug where different-device logins created duplicates),
 * keep the oldest one (has the most history attached) and soft-delete the
 * rest. Merges any missing fields (avatar, blood_group, dob, etc.) from the
 * duplicates into the canonical one so nothing is lost.
 *
 * Safe to call on every app load — idempotent, no-op if no duplicates.
 */
export async function dedupeSelfMembers(userId: string): Promise<void> {
  const selves = await db.members
    .where("user_id")
    .equals(userId)
    .filter((m) => m.relation === "self" && !m.is_deleted)
    .toArray();

  if (selves.length <= 1) return;

  // Canonical = oldest by created_at (most likely the original one cloud knows)
  selves.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const canonical = selves[0];
  const duplicates = selves.slice(1);

  // Merge fields: canonical wins where present, duplicates fill gaps
  const merged = { ...canonical };
  for (const d of duplicates) {
    if (!merged.avatar_url && d.avatar_url) merged.avatar_url = d.avatar_url;
    if (!merged.blood_group && d.blood_group) merged.blood_group = d.blood_group;
    if (!merged.date_of_birth && d.date_of_birth) merged.date_of_birth = d.date_of_birth;
    if (!merged.gender && d.gender) merged.gender = d.gender;
    if (!merged.emergency_contact_name && d.emergency_contact_name)
      merged.emergency_contact_name = d.emergency_contact_name;
    if (!merged.emergency_contact_phone && d.emergency_contact_phone)
      merged.emergency_contact_phone = d.emergency_contact_phone;
    if (!merged.abha_number && d.abha_number) merged.abha_number = d.abha_number;
    if (!merged.abha_address && d.abha_address) merged.abha_address = d.abha_address;
    // Union arrays — don't lose allergies/conditions logged against a duplicate
    merged.allergies = Array.from(
      new Set([...(merged.allergies ?? []), ...(d.allergies ?? [])])
    );
    merged.chronic_conditions = Array.from(
      new Set([...(merged.chronic_conditions ?? []), ...(d.chronic_conditions ?? [])])
    );
  }

  const now = new Date().toISOString();

  await db.transaction(
    "rw",
    [db.members, db.records, db.medicines, db.reminders, db.healthMetrics],
    async () => {
      // Update canonical with merged fields
      await db.members.update(canonical.id, {
        ...merged,
        id: canonical.id, // never overwrite id
        updated_at: now,
        sync_status: "pending",
      });

      // Reassign any records/medicines/reminders/metrics that point at a
      // duplicate so they live under the canonical member
      const dupIds = duplicates.map((d) => d.id);
      for (const dupId of dupIds) {
        const recordsForDup = await db.records
          .where("member_id")
          .equals(dupId)
          .toArray();
        for (const r of recordsForDup) {
          await db.records.update(r.id, {
            member_id: canonical.id,
            updated_at: now,
            sync_status: "pending",
          });
        }

        const medsForDup = await db.medicines
          .where("member_id")
          .equals(dupId)
          .toArray();
        for (const m of medsForDup) {
          await db.medicines.update(m.id, {
            member_id: canonical.id,
            updated_at: now,
            sync_status: "pending",
          });
        }

        const remindersForDup = await db.reminders
          .where("member_id")
          .equals(dupId)
          .toArray();
        for (const r of remindersForDup) {
          await db.reminders.update(r.id, {
            member_id: canonical.id,
            updated_at: now,
            sync_status: "pending",
          });
        }

        const metricsForDup = await db.healthMetrics
          .where("member_id")
          .equals(dupId)
          .toArray();
        for (const m of metricsForDup) {
          await db.healthMetrics.update(m.id, {
            member_id: canonical.id,
            updated_at: now,
            sync_status: "pending",
          });
        }

        // Soft-delete the duplicate itself
        await db.members.update(dupId, {
          is_deleted: true,
          updated_at: now,
          sync_status: "pending",
        });
      }
    }
  );

  console.log(
    `[dedupeSelfMembers] merged ${duplicates.length} duplicate self member(s) into ${canonical.id}`
  );
}
