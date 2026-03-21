"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { HealthMetric, MetricType } from "@/lib/db/schema";

export interface MetricFormData {
  member_id: string;
  type: MetricType;
  value: Record<string, number>;
  recorded_at: string;
  notes?: string;
}

export function useHealthMetrics(memberId?: string, type?: MetricType) {
  const metrics = useLiveQuery(
    () =>
      db.healthMetrics
        .filter(
          (m) =>
            !m.is_deleted &&
            (memberId ? m.member_id === memberId : true) &&
            (type ? m.type === type : true)
        )
        .toArray()
        .then((ms) =>
          ms.sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime()
          )
        ),
    [memberId, type]
  );

  const addMetric = async (data: MetricFormData): Promise<string> => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const metric: HealthMetric = {
      id,
      member_id: data.member_id,
      type: data.type,
      value: data.value,
      recorded_at: data.recorded_at || now,
      notes: data.notes,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.healthMetrics.add(metric);
    return id;
  };

  const deleteMetric = async (id: string): Promise<void> => {
    await db.healthMetrics.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    metrics: metrics ?? [],
    isLoading: metrics === undefined,
    addMetric,
    deleteMetric,
  };
}

export const METRIC_CONFIG: Record<
  MetricType,
  {
    label: string;
    unit: string;
    fields: { key: string; label: string; min: number; max: number }[];
    color: string;
  }
> = {
  bp: {
    label: "Blood Pressure",
    unit: "mmHg",
    fields: [
      { key: "systolic", label: "Systolic", min: 60, max: 250 },
      { key: "diastolic", label: "Diastolic", min: 40, max: 150 },
    ],
    color: "#ef4444",
  },
  sugar: {
    label: "Blood Sugar",
    unit: "mg/dL",
    fields: [{ key: "level", label: "Level", min: 30, max: 500 }],
    color: "#f59e0b",
  },
  weight: {
    label: "Weight",
    unit: "kg",
    fields: [{ key: "weight", label: "Weight", min: 1, max: 300 }],
    color: "#3b82f6",
  },
  temperature: {
    label: "Temperature",
    unit: "°F",
    fields: [{ key: "temp", label: "Temperature", min: 90, max: 110 }],
    color: "#8b5cf6",
  },
  spo2: {
    label: "SpO2",
    unit: "%",
    fields: [{ key: "level", label: "Level", min: 70, max: 100 }],
    color: "#06b6d4",
  },
};
