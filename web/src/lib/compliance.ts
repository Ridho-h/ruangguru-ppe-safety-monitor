import type {
  Detection,
  FrameCompliance,
  PpeClassName,
  SafetyPolicy,
} from "./types";

export const DEFAULT_VIOLATION_COOLDOWN_MS = 3_000;
export const MAX_VIOLATION_LOG_ENTRIES = 200;

export function evaluateFrameCompliance(
  detections: Detection[],
  policy: SafetyPolicy,
): FrameCompliance {
  let workerCount = 0;
  let compliantCount = 0;
  let violationCount = 0;
  const activeViolations: Detection[] = [];
  const visibleDetections: Detection[] = [];

  for (const det of detections) {
    const name = det.className;

    if (name === "Person") {
      workerCount += 1;
      visibleDetections.push(det);
      continue;
    }

    if (name === "Hardhat") {
      if (policy.requireHardhat) {
        compliantCount += 1;
        visibleDetections.push(det);
      }
      continue;
    }
    if (name === "Safety Vest") {
      if (policy.requireVest) {
        compliantCount += 1;
        visibleDetections.push(det);
      }
      continue;
    }
    if (name === "Mask") {
      if (policy.requireMask) {
        compliantCount += 1;
        visibleDetections.push(det);
      }
      continue;
    }

    if (name === "NO-Hardhat") {
      if (policy.requireHardhat) {
        violationCount += 1;
        activeViolations.push(det);
        visibleDetections.push(det);
      }
      continue;
    }
    if (name === "NO-Safety Vest") {
      if (policy.requireVest) {
        violationCount += 1;
        activeViolations.push(det);
        visibleDetections.push(det);
      }
      continue;
    }
    if (name === "NO-Mask") {
      if (policy.requireMask) {
        violationCount += 1;
        activeViolations.push(det);
        visibleDetections.push(det);
      }
      continue;
    }
  }

  const totalPpe = compliantCount + violationCount;
  const complianceScore =
    totalPpe > 0 ? Math.round((compliantCount / totalPpe) * 100) : null;

  return {
    workerCount,
    compliantCount,
    violationCount,
    complianceScore,
    activeViolations,
    visibleDetections,
  };
}

export function shouldRecordViolation(
  violationType: PpeClassName | string,
  nowMs: number,
  lastLoggedMap: Map<string, number>,
  cooldownMs = DEFAULT_VIOLATION_COOLDOWN_MS,
): boolean {
  const prev = lastLoggedMap.get(violationType);
  if (prev !== undefined && nowMs - prev < cooldownMs) {
    return false;
  }
  lastLoggedMap.set(violationType, nowMs);
  return true;
}

export function formatWibTime(date = new Date()): string {
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date) + " WIB"
  );
}
