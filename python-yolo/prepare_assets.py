"""Downloads ppe-yolov8n.onnx from Hugging Face and builds a browser-playable H.264 Live CCTV MP4."""

from __future__ import annotations

from pathlib import Path
import shutil
import cv2
import imageio.v2 as imageio
import numpy as np
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "web" / "public" / "models"
STREAMS_DIR = ROOT / "web" / "public" / "streams"
SCENES_DIR = Path(__file__).resolve().parent / "scenes"


def download_ppe_onnx() -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    target = MODELS_DIR / "ppe-yolov8n.onnx"
    if not target.exists():
        cached = hf_hub_download(
            repo_id="mancalazure/construction-ppe-safety",
            filename="best.onnx",
        )
        shutil.copyfile(cached, target)
    print(f"ONNX model ready: {target} ({target.stat().st_size / (1024 * 1024):.2f} MB)")
    return target


def build_cctv_stream_mp4(
    out_path: Path | None = None,
    width: int = 960,
    height: int = 540,
    fps: int = 15,
    seconds_per_scene: int = 4,
) -> Path:
    STREAMS_DIR.mkdir(parents=True, exist_ok=True)
    if out_path is None:
        out_path = STREAMS_DIR / "cctv_construction_live.mp4"

    scene_files = sorted(
        list(SCENES_DIR.glob("scene_*.png")) + list(SCENES_DIR.glob("scene_*.jpg"))
    )
    if not scene_files:
        raise FileNotFoundError(f"No scene_*.png files found in {SCENES_DIR}")

    frames_per_scene = fps * seconds_per_scene
    writer = imageio.get_writer(
        str(out_path),
        fps=fps,
        codec="libx264",
        quality=7,
        macro_block_size=16,
        ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
    )

    try:
        for scene_idx, img_path in enumerate(scene_files):
            bgr = cv2.imread(str(img_path))
            if bgr is None:
                raise RuntimeError(f"Failed to read {img_path}")
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            sh, sw = rgb.shape[:2]

            for f in range(frames_per_scene):
                t = f / max(1, frames_per_scene - 1)
                # Subtle CCTV pan/zoom sweep (1.00 -> 1.07x) so each frame has realistic live motion
                zoom = 1.0 + 0.06 * np.sin(t * np.pi)
                crop_w = int(sw / zoom)
                crop_h = int(sh / zoom)
                max_x = max(0, sw - crop_w)
                max_y = max(0, sh - crop_h)
                x0 = int(max_x * (t if scene_idx % 2 == 0 else (1.0 - t)))
                y0 = int(max_y * 0.5)

                cropped = rgb[y0 : y0 + crop_h, x0 : x0 + crop_w]
                resized = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_AREA)
                writer.append_data(resized)
    finally:
        writer.close()

    print(
        f"Live CCTV MP4 ready: {out_path} ({out_path.stat().st_size / 1024:.1f} KB, "
        f"{len(scene_files) * frames_per_scene} frames @ {fps}fps)"
    )
    return out_path


if __name__ == "__main__":
    download_ppe_onnx()
    build_cctv_stream_mp4()
