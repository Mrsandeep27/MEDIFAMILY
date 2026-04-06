import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  PIN_LENGTH,
  PIN_LOCK_TIMEOUT_MS,
  SYNC_INTERVAL_MS,
  MAX_IMAGE_SIZE_KB,
  MAX_IMAGES_PER_RECORD,
  RECORD_TYPE_LABELS,
  RELATION_LABELS,
  BLOOD_GROUPS,
  FREQUENCY_LABELS,
  SHARE_LINK_DEFAULT_HOURS,
  SHARE_LINK_OPTIONS_HOURS,
  REMINDER_CHECK_INTERVAL_MS,
  QUIET_HOURS_START,
  QUIET_HOURS_END,
} from "@/constants/config";

describe("App Configuration", () => {
  it("has correct app name", () => {
    expect(APP_NAME).toBe("MediFamily");
  });

  it("PIN config is valid", () => {
    expect(PIN_LENGTH).toBe(4);
    expect(PIN_LOCK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(PIN_LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000); // 5 minutes
  });

  it("sync interval is reasonable (>= 5 min)", () => {
    expect(SYNC_INTERVAL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it("image limits are set", () => {
    expect(MAX_IMAGE_SIZE_KB).toBeGreaterThan(0);
    expect(MAX_IMAGES_PER_RECORD).toBeGreaterThan(0);
    expect(MAX_IMAGES_PER_RECORD).toBeLessThanOrEqual(20);
  });

  it("record type labels cover all types", () => {
    const expectedTypes = ["prescription", "lab_report", "vaccination", "bill", "discharge_summary", "other"];
    for (const type of expectedTypes) {
      expect(RECORD_TYPE_LABELS[type]).toBeDefined();
      expect(typeof RECORD_TYPE_LABELS[type]).toBe("string");
    }
  });

  it("relation labels cover all relations", () => {
    const expectedRelations = ["self", "spouse", "father", "mother", "son", "daughter", "grandfather", "grandmother", "brother", "sister", "other"];
    for (const rel of expectedRelations) {
      expect(RELATION_LABELS[rel]).toBeDefined();
    }
  });

  it("blood groups are valid", () => {
    expect(BLOOD_GROUPS).toContain("A+");
    expect(BLOOD_GROUPS).toContain("O-");
    expect(BLOOD_GROUPS).toContain("AB+");
    expect(BLOOD_GROUPS.length).toBe(8);
  });

  it("frequency labels are defined", () => {
    expect(FREQUENCY_LABELS["once_daily"]).toBeDefined();
    expect(FREQUENCY_LABELS["twice_daily"]).toBeDefined();
    expect(FREQUENCY_LABELS["thrice_daily"]).toBeDefined();
  });

  it("share link options are valid", () => {
    expect(SHARE_LINK_DEFAULT_HOURS).toBeGreaterThan(0);
    expect(SHARE_LINK_OPTIONS_HOURS.length).toBeGreaterThan(0);
    expect(SHARE_LINK_OPTIONS_HOURS).toContain(SHARE_LINK_DEFAULT_HOURS);
  });

  it("reminder config is valid", () => {
    expect(REMINDER_CHECK_INTERVAL_MS).toBeGreaterThan(0);
    expect(QUIET_HOURS_START).toMatch(/^\d{2}:\d{2}$/);
    expect(QUIET_HOURS_END).toMatch(/^\d{2}:\d{2}$/);
  });
});
