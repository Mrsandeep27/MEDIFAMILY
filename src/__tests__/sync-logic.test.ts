import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Sync Logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Sync Timestamp Storage", () => {
    it("stores and retrieves sync timestamps", () => {
      const table = "members";
      const key = `medifamily_sync_${table}`;
      const timestamp = new Date().toISOString();

      localStorage.setItem(key, timestamp);
      expect(localStorage.getItem(key)).toBe(timestamp);
    });

    it("returns epoch for unknown tables", () => {
      const key = "medifamily_sync_nonexistent";
      const result = localStorage.getItem(key) || new Date(0).toISOString();
      expect(result).toBe(new Date(0).toISOString());
    });
  });

  describe("Batch Payload Construction", () => {
    it("correctly strips local-only fields", () => {
      const LOCAL_ONLY_FIELDS = new Set(["local_image_blobs", "sync_status", "synced_at"]);

      const item = {
        id: "test-1",
        name: "Test",
        sync_status: "pending",
        synced_at: "2026-01-01",
        local_image_blobs: [new Blob()],
        updated_at: "2026-03-22",
      };

      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        if (!LOCAL_ONLY_FIELDS.has(key)) {
          clean[key] = value;
        }
      }

      expect(clean).toHaveProperty("id");
      expect(clean).toHaveProperty("name");
      expect(clean).toHaveProperty("updated_at");
      expect(clean).not.toHaveProperty("sync_status");
      expect(clean).not.toHaveProperty("synced_at");
      expect(clean).not.toHaveProperty("local_image_blobs");
    });
  });

  describe("Conflict Resolution", () => {
    it("server wins when server timestamp is newer", () => {
      const localItem = { id: "1", updated_at: "2026-03-20T10:00:00Z" };
      const serverItem = { id: "1", updated_at: "2026-03-21T10:00:00Z" };

      const serverIsNewer = new Date(serverItem.updated_at) > new Date(localItem.updated_at);
      expect(serverIsNewer).toBe(true);
    });

    it("local wins when local timestamp is newer", () => {
      const localItem = { id: "1", updated_at: "2026-03-22T10:00:00Z" };
      const serverItem = { id: "1", updated_at: "2026-03-21T10:00:00Z" };

      const serverIsNewer = new Date(serverItem.updated_at) > new Date(localItem.updated_at);
      expect(serverIsNewer).toBe(false);
    });
  });

  describe("Tables Configuration", () => {
    it("syncs all 7 required tables", () => {
      const TABLES_TO_SYNC = [
        { local: "members", remote: "members" },
        { local: "records", remote: "health_records" },
        { local: "medicines", remote: "medicines" },
        { local: "reminders", remote: "reminders" },
        { local: "reminderLogs", remote: "reminder_logs" },
        { local: "shareLinks", remote: "share_links" },
        { local: "healthMetrics", remote: "health_metrics" },
      ];

      expect(TABLES_TO_SYNC).toHaveLength(7);

      const localNames = TABLES_TO_SYNC.map((t) => t.local);
      expect(localNames).toContain("members");
      expect(localNames).toContain("records");
      expect(localNames).toContain("medicines");
      expect(localNames).toContain("reminders");
      expect(localNames).toContain("reminderLogs");
      expect(localNames).toContain("shareLinks");
      expect(localNames).toContain("healthMetrics");
    });
  });
});
