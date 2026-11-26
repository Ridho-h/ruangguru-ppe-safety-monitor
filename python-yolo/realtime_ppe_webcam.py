"""Real-Time Workplace Safety (K3) PPE Monitor — Python OpenCV + ONNX/YOLO Syllabus Script.

Mendukung sumber kamera webcam lokal (`--source 0`), RTSP CCTV, atau file video MP4.
Menggunakan model YOLOv8n PPE (`mancalazure/construction-ppe-safety`, 10 kelas).
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path
import time
import cv2
import numpy as np
import onnxruntime as ort

CLASS_NAMES = [
    "Hardhat",
    "Mask",
    "NO-Hardhat",
    "NO-Mask",
    "NO-Safety Vest",
    "Person",
    "Safety Cone",
    "Safety Vest",
    "machinery",
    "vehicle",
]

COMPLIANT_CLASSES = {"Hardhat", "Safety Vest", "Mask"}
VIOLATION_CLASSES = {"NO-Hardhat", "NO-Safety Vest", "NO-Mask"}


def letterbox(
    image: np.ndarray, target_size: int = 640
) -> tuple[np.ndarray, float, int, int]:
    h, w = image.shape[:2]
    scale = min(target_size / w, target_size / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w = (target_size - new_w) // 2
    pad_h = (target_size - new_h) // 2
    canvas = np.full((target_size, target_size, 3), 114, dtype=np.uint8)
    canvas[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized
    return canvas, scale, pad_w, pad_h


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    order = scores.argsort()[::-1]
    keep: list[int] = []

    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        iou = inter / np.maximum(1e-6, areas[i] + areas[order[1:]] - inter)
        order = order[np.where(iou <= iou_threshold)[0] + 1]

    return keep


def run_onnx_frame_inference(
    session: ort.InferenceSession,
    frame_bgr: np.ndarray,
    conf_threshold: float = 0.45,
    iou_threshold: float = 0.45,
) -> list[dict]:
    """Runs YOLOv8n PPE ONNX inference on a single BGR frame."""
    h, w = frame_bgr.shape[:2]
    lb, scale, pad_x, pad_y = letterbox(frame_bgr, 640)
    rgb = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    blob = np.transpose(rgb, (2, 0, 1))[None, ...]

    input_name = session.get_inputs()[0].name
    raw = session.run(None, {input_name: blob})[0]  # [1, 14, 8400]
    preds = raw[0].T  # [8400, 14]

    boxes_xywh = preds[:, :4]
    class_scores = preds[:, 4:]
    class_ids = np.argmax(class_scores, axis=1)
    confidences = class_scores[np.arange(len(preds)), class_ids]

    mask = confidences >= conf_threshold
    if not np.any(mask):
        return []

    boxes_xywh = boxes_xywh[mask]
    class_ids = class_ids[mask]
    confidences = confidences[mask]

    cx, cy, bw, bh = (
        boxes_xywh[:, 0],
        boxes_xywh[:, 1],
        boxes_xywh[:, 2],
        boxes_xywh[:, 3],
    )
    x1 = np.clip((cx - bw / 2.0 - pad_x) / scale, 0, w)
    y1 = np.clip((cy - bh / 2.0 - pad_y) / scale, 0, h)
    x2 = np.clip((cx + bw / 2.0 - pad_x) / scale, 0, w)
    y2 = np.clip((cy + bh / 2.0 - pad_y) / scale, 0, h)
    xyxy = np.stack([x1, y1, x2, y2], axis=1)

    results: list[dict] = []
    for cls_id in np.unique(class_ids):
        cls_idx = np.where(class_ids == cls_id)[0]
        keep = _nms(xyxy[cls_idx], confidences[cls_idx], iou_threshold)
        for k in keep:
            idx = cls_idx[k]
            results.append(
                {
                    "class_id": int(cls_id),
                    "class_name": CLASS_NAMES[int(cls_id)],
                    "confidence": round(float(confidences[idx]), 4),
                    "bbox": [float(v) for v in xyxy[idx]],
                }
            )
    return results


def compute_compliance_summary(
    detections: list[dict],
    require_hardhat: bool = True,
    require_vest: bool = True,
    require_mask: bool = False,
) -> dict:
    workers = sum(1 for d in detections if d["class_name"] == "Person")
    compliant = 0
    violations = 0
    active_violations: list[dict] = []

    for d in detections:
        name = d["class_name"]
        if name == "Hardhat" and require_hardhat:
            compliant += 1
        elif name == "Safety Vest" and require_vest:
            compliant += 1
        elif name == "Mask" and require_mask:
            compliant += 1
        elif name == "NO-Hardhat" and require_hardhat:
            violations += 1
            active_violations.append(d)
        elif name == "NO-Safety Vest" and require_vest:
            violations += 1
            active_violations.append(d)
        elif name == "NO-Mask" and require_mask:
            violations += 1
            active_violations.append(d)

    total_ppe = compliant + violations
    score = int(round((compliant / total_ppe) * 100)) if total_ppe > 0 else None
    return {
        "workers": workers,
        "compliant": compliant,
        "violations": violations,
        "compliance_score": score,
        "active_violations": active_violations,
    }


def run_live_monitor(
    source: str | int = 0,
    model_path: str | Path | None = None,
    conf_threshold: float = 0.45,
    log_csv: str | Path = "ppe_violations_log.csv",
) -> None:
    if model_path is None:
        model_path = (
            Path(__file__).resolve().parent.parent
            / "web"
            / "public"
            / "models"
            / "ppe-yolov8n.onnx"
        )
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Tidak dapat membuka sumber video: {source}")

    last_logged: dict[str, float] = {}
    csv_path = Path(log_csv)
    if not csv_path.exists():
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(["timestamp", "violation", "confidence"])

    try:
        while True:
            t0 = time.perf_counter()
            ok, frame = cap.read()
            if not ok:
                break

            dets = run_onnx_frame_inference(session, frame, conf_threshold=conf_threshold)
            summary = compute_compliance_summary(dets)
            now = time.time()

            for v in summary["active_violations"]:
                v_name = v["class_name"]
                if now - last_logged.get(v_name, 0.0) >= 3.0:
                    last_logged[v_name] = now
                    with csv_path.open("a", newline="", encoding="utf-8") as f:
                        csv.writer(f).writerow(
                            [datetime.now().strftime("%Y-%m-%d %H:%M:%S"), v_name, v["confidence"]]
                        )

            for d in dets:
                x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
                name = d["class_name"]
                color = (
                    (60, 20, 225)
                    if name in VIOLATION_CLASSES
                    else (129, 185, 16)
                    if name in COMPLIANT_CLASSES
                    else (246, 130, 59)
                )
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    f"{name} {int(d['confidence'] * 100)}%",
                    (x1, max(18, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                )

            fps = 1.0 / max(1e-4, time.perf_counter() - t0)
            score_txt = (
                f"{summary['compliance_score']}%"
                if summary["compliance_score"] is not None
                else "Siaga"
            )
            cv2.putText(
                frame,
                f"K3 Compliance: {score_txt} | Violations: {summary['violations']} | FPS: {fps:.1f}",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (255, 255, 255),
                2,
            )
            cv2.imshow("UC-03 Workplace Safety (K3) PPE Monitor", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Real-time K3 PPE Monitor (OpenCV + ONNX)")
    parser.add_argument("--source", default="0", help="Webcam index (0) atau path video/RTSP")
    parser.add_argument("--conf", type=float, default=0.70, help="Confidence threshold")
    args = parser.parse_args()
    src: str | int = int(args.source) if args.source.isdigit() else args.source
    run_live_monitor(source=src, conf_threshold=args.conf)
