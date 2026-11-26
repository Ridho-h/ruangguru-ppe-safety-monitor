import type { DetectionCategory, PpeClassName } from "../types";

export interface PpeClassMeta {
  id: number;
  name: PpeClassName;
  labelId: string;
  category: DetectionCategory;
  color: string;
}

export const PPE_CLASSES: readonly PpeClassMeta[] = [
  { id: 0, name: "Hardhat", labelId: "Helm K3", category: "compliant", color: "#10b981" },
  { id: 1, name: "Mask", labelId: "Masker", category: "compliant", color: "#10b981" },
  { id: 2, name: "NO-Hardhat", labelId: "Tanpa Helm", category: "violation", color: "#e11d48" },
  { id: 3, name: "NO-Mask", labelId: "Tanpa Masker", category: "violation", color: "#e11d48" },
  { id: 4, name: "NO-Safety Vest", labelId: "Tanpa Rompi", category: "violation", color: "#e11d48" },
  { id: 5, name: "Person", labelId: "Pekerja", category: "context", color: "#3b82f6" },
  { id: 6, name: "Safety Cone", labelId: "Kerucut K3", category: "context", color: "#64748b" },
  { id: 7, name: "Safety Vest", labelId: "Rompi K3", category: "compliant", color: "#10b981" },
  { id: 8, name: "machinery", labelId: "Alat Berat", category: "context", color: "#64748b" },
  { id: 9, name: "vehicle", labelId: "Kendaraan", category: "context", color: "#64748b" },
] as const;

export function getClassMeta(classId: number): PpeClassMeta | undefined {
  return PPE_CLASSES[classId];
}
