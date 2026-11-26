export type PpeClassName =
  | "Hardhat"
  | "Mask"
  | "NO-Hardhat"
  | "NO-Mask"
  | "NO-Safety Vest"
  | "Person"
  | "Safety Cone"
  | "Safety Vest"
  | "machinery"
  | "vehicle";

export type DetectionCategory = "compliant" | "violation" | "context";

export interface Detection {
  classId: number;
  className: PpeClassName;
  labelId: string;
  category: DetectionCategory;
  confidence: number;
  /** [x1, y1, x2, y2] in original source video pixel coordinates */
  bbox: [number, number, number, number];
}

export interface LetterboxMeta {
  srcWidth: number;
  srcHeight: number;
  targetSize: number;
  scale: number;
  newWidth: number;
  newHeight: number;
  padX: number;
  padY: number;
}

export interface SafetyPolicy {
  requireHardhat: boolean;
  requireVest: boolean;
  requireMask: boolean;
}

export interface FrameCompliance {
  workerCount: number;
  compliantCount: number;
  violationCount: number;
  /** 0-100 integer, or null when no policy-relevant PPE/violation is present */
  complianceScore: number | null;
  activeViolations: Detection[];
  visibleDetections: Detection[];
}

export type StreamSourceMode = "cctv" | "webcam";

export interface ViolationLogEntry {
  id: string;
  timestampWib: string;
  sourceLabel: string;
  className: PpeClassName;
  violationLabel: string;
  confidencePct: number;
  workerCount: number;
  snapshotUrl: string | null;
}

export interface InferenceTelemetry {
  fps: number;
  latencyMs: number;
  backend: "webgpu" | "wasm" | "loading";
}
