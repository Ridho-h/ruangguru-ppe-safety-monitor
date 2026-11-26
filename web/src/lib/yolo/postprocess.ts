import type { Detection, LetterboxMeta } from "../types";
import { getClassMeta, PPE_CLASSES } from "./classes";

function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;

  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - interArea;
  return union > 0 ? interArea / union : 0;
}

/**
 * Decodes standard YOLOv8 ONNX output tensor [1, 4 + numClasses, numBoxes] (e.g. [1, 14, 8400]),
 * applies confidence thresholding, un-letterboxes to source video coordinates, and runs class-wise NMS.
 */
export function decodeYoloOutput(
  output: Float32Array,
  dims: readonly number[],
  meta: LetterboxMeta,
  confThreshold = 0.45,
  iouThreshold = 0.45,
): Detection[] {
  const numChannels = dims[1] ?? 4 + PPE_CLASSES.length;
  const numBoxes = dims[2] ?? Math.floor(output.length / numChannels);
  const numClasses = Math.min(PPE_CLASSES.length, numChannels - 4);
  if (numBoxes <= 0 || numClasses <= 0) return [];

  const candidatesByClass = new Map<number, Detection[]>();

  for (let i = 0; i < numBoxes; i += 1) {
    let bestClassId = -1;
    let bestScore = confThreshold;

    for (let c = 0; c < numClasses; c += 1) {
      const score = output[(4 + c) * numBoxes + i];
      if (score >= bestScore) {
        bestScore = score;
        bestClassId = c;
      }
    }

    if (bestClassId < 0) continue;
    const clsMeta = getClassMeta(bestClassId);
    if (!clsMeta) continue;

    const cx = output[i];
    const cy = output[numBoxes + i];
    const bw = output[2 * numBoxes + i];
    const bh = output[3 * numBoxes + i];

    const x1 = Math.max(0, Math.min(meta.srcWidth, (cx - bw / 2 - meta.padX) / meta.scale));
    const y1 = Math.max(0, Math.min(meta.srcHeight, (cy - bh / 2 - meta.padY) / meta.scale));
    const x2 = Math.max(0, Math.min(meta.srcWidth, (cx + bw / 2 - meta.padX) / meta.scale));
    const y2 = Math.max(0, Math.min(meta.srcHeight, (cy + bh / 2 - meta.padY) / meta.scale));

    if (x2 - x1 < 4 || y2 - y1 < 4) continue;

    const det: Detection = {
      classId: bestClassId,
      className: clsMeta.name,
      labelId: clsMeta.labelId,
      category: clsMeta.category,
      confidence: Number(bestScore.toFixed(4)),
      bbox: [x1, y1, x2, y2],
    };

    const list = candidatesByClass.get(bestClassId) ?? [];
    list.push(det);
    candidatesByClass.set(bestClassId, list);
  }

  const kept: Detection[] = [];
  for (const list of candidatesByClass.values()) {
    list.sort((a, b) => b.confidence - a.confidence);
    const selected: Detection[] = [];

    for (const candidate of list) {
      const overlaps = selected.some(
        (existing) => computeIoU(existing.bbox, candidate.bbox) > iouThreshold,
      );
      if (!overlaps) {
        selected.push(candidate);
      }
    }
    kept.push(...selected);
  }

  return kept.sort((a, b) => b.confidence - a.confidence);
}
