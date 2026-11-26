import { describe, expect, it } from "vitest";
import {
  evaluateFrameCompliance,
  shouldRecordViolation,
} from "../compliance";
import { toSafeCsv } from "../csv";
import { decodeYoloOutput } from "../yolo/postprocess";
import { computeLetterbox, rgbaToNchwFloat32 } from "../yolo/preprocess";

describe("YOLOv8 Letterbox & Tensor Preprocessing (Review Focus #5)", () => {
  it("computes accurate letterbox scaling and padding for 16:9 landscape and 9:16 portrait", () => {
    const landscape = computeLetterbox(1280, 720, 640);
    expect(landscape.scale).toBeCloseTo(0.5, 4);
    expect(landscape.newWidth).toBe(640);
    expect(landscape.newHeight).toBe(360);
    expect(landscape.padX).toBe(0);
    expect(landscape.padY).toBe(140);

    const portrait = computeLetterbox(720, 1280, 640);
    expect(portrait.scale).toBeCloseTo(0.5, 4);
    expect(portrait.newWidth).toBe(360);
    expect(portrait.newHeight).toBe(640);
    expect(portrait.padX).toBe(140);
    expect(portrait.padY).toBe(0);
  });

  it("converts RGBA pixel buffer into normalized CHW Float32Array [0, 1]", () => {
    // 2x2 image: pixel 0 = pure red (255,0,0,255), pixel 1 = pure green (0,255,0,255)
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      128, 128, 128, 255,
    ]);
    const chw = rgbaToNchwFloat32(rgba, 2);
    expect(chw.length).toBe(3 * 2 * 2);
    expect(chw[0]).toBeCloseTo(1.0, 4); // R[0]
    expect(chw[1]).toBeCloseTo(0.0, 4); // R[1]
    expect(chw[5]).toBeCloseTo(1.0, 4); // G[1]
    expect(chw[10]).toBeCloseTo(1.0, 4); // B[2]
  });
});

describe("YOLOv8 Output Decoding & Class-Wise NMS", () => {
  it("decodes [1, 14, 8400] tensor, deduplicates overlapping boxes via NMS, and un-letterboxes to source coords", () => {
    const numBoxes = 8400;
    const numChannels = 14; // 4 coords + 10 classes
    const output = new Float32Array(numChannels * numBoxes);

    // Helper to write box at anchor index `i`
    const writeAnchor = (
      i: number,
      cx: number,
      cy: number,
      w: number,
      h: number,
      clsId: number,
      score: number,
    ) => {
      output[0 * numBoxes + i] = cx;
      output[1 * numBoxes + i] = cy;
      output[2 * numBoxes + i] = w;
      output[3 * numBoxes + i] = h;
      output[(4 + clsId) * numBoxes + i] = score;
    };

    // Two strongly overlapping Hardhat (class 0) boxes -> NMS keeps higher score (0.91)
    writeAnchor(10, 320, 320, 100, 100, 0, 0.91);
    writeAnchor(11, 324, 322, 98, 98, 0, 0.78);
    // One NO-Hardhat (class 2) box far away
    writeAnchor(25, 160, 260, 80, 80, 2, 0.85);
    // Below threshold -> ignored
    writeAnchor(30, 400, 400, 50, 50, 7, 0.25);

    const meta = computeLetterbox(1280, 720, 640);
    const dets = decodeYoloOutput(output, [1, 14, 8400], meta, 0.45, 0.45);

    expect(dets).toHaveLength(2);
    const hardhat = dets.find((d) => d.className === "Hardhat");
    const noHardhat = dets.find((d) => d.className === "NO-Hardhat");
    expect(hardhat).toBeDefined();
    expect(hardhat!.confidence).toBeCloseTo(0.91, 2);
    // Un-letterbox check: cx=320, w=100 -> x1=(270-0)/0.5 = 540, x2=740
    expect(hardhat!.bbox[0]).toBeCloseTo(540, 0);
    expect(hardhat!.bbox[2]).toBeCloseTo(740, 0);
    expect(noHardhat).toBeDefined();
  });
});

describe("K3 Compliance Logic, 3s Anti-Spam Cooldown & Safe CSV Export (Review Focus #3)", () => {
  it("computes compliance score respecting active policy toggles and returns null when idle", () => {
    const idle = evaluateFrameCompliance([], {
      requireHardhat: true,
      requireVest: true,
      requireMask: false,
    });
    expect(idle.complianceScore).toBeNull();

    const dets = [
      { classId: 5, className: "Person" as const, labelId: "Pekerja", category: "context" as const, confidence: 0.92, bbox: [0, 0, 100, 200] as [number, number, number, number] },
      { classId: 0, className: "Hardhat" as const, labelId: "Helm K3", category: "compliant" as const, confidence: 0.88, bbox: [10, 0, 60, 50] as [number, number, number, number] },
      { classId: 4, className: "NO-Safety Vest" as const, labelId: "Tanpa Rompi", category: "violation" as const, confidence: 0.82, bbox: [10, 60, 90, 150] as [number, number, number, number] },
      { classId: 3, className: "NO-Mask" as const, labelId: "Tanpa Masker", category: "violation" as const, confidence: 0.79, bbox: [20, 20, 50, 45] as [number, number, number, number] },
    ];

    const defaultEval = evaluateFrameCompliance(dets, {
      requireHardhat: true,
      requireVest: true,
      requireMask: false,
    });
    expect(defaultEval.workerCount).toBe(1);
    expect(defaultEval.compliantCount).toBe(1);
    expect(defaultEval.violationCount).toBe(1);
    expect(defaultEval.complianceScore).toBe(50);

    const strictEval = evaluateFrameCompliance(dets, {
      requireHardhat: true,
      requireVest: true,
      requireMask: true,
    });
    expect(strictEval.violationCount).toBe(2);
    expect(strictEval.complianceScore).toBe(33);
  });

  it("enforces 3,000ms anti-spam cooldown per violation type", () => {
    const map = new Map<string, number>();
    expect(shouldRecordViolation("NO-Hardhat", 10_000, map, 3_000)).toBe(true);
    expect(shouldRecordViolation("NO-Hardhat", 11_500, map, 3_000)).toBe(false);
    expect(shouldRecordViolation("NO-Safety Vest", 11_500, map, 3_000)).toBe(true);
    expect(shouldRecordViolation("NO-Hardhat", 13_100, map, 3_000)).toBe(true);
  });

  it("prefixes CSV formula injection payloads (=, +, -, @)", () => {
    const csv = toSafeCsv(["Waktu", "Pelanggaran"], [["10:00:00", "=HYPERLINK(\"x\")"]]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
