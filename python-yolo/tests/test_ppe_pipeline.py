from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort

from realtime_ppe_webcam import (
    CLASS_NAMES,
    compute_compliance_summary,
    run_onnx_frame_inference,
)

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "web" / "public" / "models" / "ppe-yolov8n.onnx"
STREAM_PATH = ROOT / "web" / "public" / "streams" / "cctv_construction_live.mp4"


def test_onnx_model_exists_and_has_expected_yolov8_ppe_contract():
    assert MODEL_PATH.exists(), f"Missing ONNX model at {MODEL_PATH}"
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    out = session.get_outputs()[0]

    assert list(inp.shape)[1:] == [3, 640, 640]
    assert list(out.shape)[1] == 4 + len(CLASS_NAMES)
    assert list(out.shape)[2] == 8400


def test_live_cctv_stream_is_playable_and_triggers_real_ppe_detections():
    assert STREAM_PATH.exists(), f"Missing Live CCTV stream at {STREAM_PATH}"
    cap = cv2.VideoCapture(str(STREAM_PATH))
    assert cap.isOpened()

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    assert frame_count >= 60

    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    detected_classes: set[str] = set()
    sample_indices = np.linspace(0, frame_count - 1, num=8, dtype=int)

    for idx in sample_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        assert ok and frame is not None
        dets = run_onnx_frame_inference(session, frame, conf_threshold=0.30)
        for d in dets:
            detected_classes.add(d["class_name"])

    cap.release()
    assert len(detected_classes) >= 1, (
        "Expected real YOLOv8n PPE/Person detections on cctv_construction_live.mp4"
    )


def test_compute_compliance_summary_respects_policy_toggles():
    detections = [
        {"class_name": "Person", "confidence": 0.9},
        {"class_name": "Hardhat", "confidence": 0.88},
        {"class_name": "NO-Safety Vest", "confidence": 0.82},
        {"class_name": "NO-Mask", "confidence": 0.77},
    ]

    summary_default = compute_compliance_summary(
        detections, require_hardhat=True, require_vest=True, require_mask=False
    )
    assert summary_default["workers"] == 1
    assert summary_default["compliant"] == 1
    assert summary_default["violations"] == 1
    assert summary_default["compliance_score"] == 50

    summary_strict = compute_compliance_summary(
        detections, require_hardhat=True, require_vest=True, require_mask=True
    )
    assert summary_strict["violations"] == 2
    assert summary_strict["compliance_score"] == 33
