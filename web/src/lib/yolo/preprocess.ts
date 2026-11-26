import type { LetterboxMeta } from "../types";

export const YOLO_INPUT_SIZE = 640;

export function computeLetterbox(
  srcWidth: number,
  srcHeight: number,
  targetSize = YOLO_INPUT_SIZE,
): LetterboxMeta {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const scale = Math.min(targetSize / safeW, targetSize / safeH);
  const newWidth = Math.round(safeW * scale);
  const newHeight = Math.round(safeH * scale);
  const padX = Math.floor((targetSize - newWidth) / 2);
  const padY = Math.floor((targetSize - newHeight) / 2);

  return {
    srcWidth: safeW,
    srcHeight: safeH,
    targetSize,
    scale,
    newWidth,
    newHeight,
    padX,
    padY,
  };
}

/**
 * Converts RGBA pixel buffer (H*W*4) into CHW Float32Array normalized to [0, 1].
 */
export function rgbaToNchwFloat32(
  rgba: Uint8ClampedArray,
  size = YOLO_INPUT_SIZE,
  reuseBuffer?: Float32Array,
): Float32Array {
  const pixelCount = size * size;
  const out =
    reuseBuffer && reuseBuffer.length === 3 * pixelCount
      ? reuseBuffer
      : new Float32Array(3 * pixelCount);

  const gOffset = pixelCount;
  const bOffset = pixelCount * 2;
  const inv255 = 1 / 255;

  for (let i = 0; i < pixelCount; i += 1) {
    const base = i * 4;
    out[i] = rgba[base] * inv255;
    out[gOffset + i] = rgba[base + 1] * inv255;
    out[bOffset + i] = rgba[base + 2] * inv255;
  }

  return out;
}
