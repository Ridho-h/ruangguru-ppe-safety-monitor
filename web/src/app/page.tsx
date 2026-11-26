"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KpiStrip } from "@/components/KpiStrip";
import { LiveViewport } from "@/components/LiveViewport";
import { PolicyControls } from "@/components/PolicyControls";
import { TopBar } from "@/components/TopBar";
import { ViolationLogPanel } from "@/components/ViolationLogPanel";
import {
  DEFAULT_VIOLATION_COOLDOWN_MS,
  evaluateFrameCompliance,
  formatWibTime,
  MAX_VIOLATION_LOG_ENTRIES,
  shouldRecordViolation,
} from "@/lib/compliance";
import { toSafeCsv } from "@/lib/csv";
import type {
  Detection,
  FrameCompliance,
  InferenceTelemetry,
  SafetyPolicy,
  StreamSourceMode,
  ViolationLogEntry,
} from "@/lib/types";
import { getClassMeta } from "@/lib/yolo/classes";
import { YoloPpeEngine } from "@/lib/yolo/engine";

const EMPTY_COMPLIANCE: FrameCompliance = {
  workerCount: 0,
  compliantCount: 0,
  violationCount: 0,
  complianceScore: null,
  activeViolations: [],
  visibleDetections: [],
};

function drawDetectionsOnCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return;

  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, vw, vh);

  const fontSize = Math.max(13, Math.round(vw / 58));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";

  for (const det of detections) {
    const [x1, y1, x2, y2] = det.bbox;
    const w = x2 - x1;
    const h = y2 - y1;
    const meta = getClassMeta(det.classId);
    const color = meta?.color ?? "#3b82f6";
    const isViolation = det.category === "violation";
    const isPerson = det.className === "Person";

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isViolation ? 3 : isPerson ? 1.75 : 2.5;
    if (isPerson) ctx.setLineDash([6, 4]);
    ctx.strokeRect(x1, y1, w, h);
    ctx.restore();

    const label = `${det.labelId} ${Math.round(det.confidence * 100)}%`;
    const textWidth = ctx.measureText(label).width;
    const padX = 6;
    const padY = 3;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2;
    const labelX = Math.min(x1, Math.max(0, vw - boxW));
    const labelY = y1 >= boxH + 2 ? y1 - boxH - 2 : y1 + 2;

    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, boxW, boxH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, labelX + padX, labelY + padY);
  }
}

function captureSnapshot(
  video: HTMLVideoElement,
  overlayCanvas: HTMLCanvasElement,
): string | null {
  try {
    const snap = document.createElement("canvas");
    snap.width = 160;
    snap.height = 90;
    const ctx = snap.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, snap.width, snap.height);
    ctx.drawImage(overlayCanvas, 0, 0, snap.width, snap.height);
    return snap.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<YoloPpeEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInferringRef = useRef(false);
  const streamEpochRef = useRef(0);
  const lastLoggedRef = useRef<Map<string, number>>(new Map());
  const fpsEmaRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const [sourceMode, setSourceMode] = useState<StreamSourceMode>("cctv");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("user");
  const [isPaused, setIsPaused] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [policy, setPolicy] = useState<SafetyPolicy>({
    requireHardhat: true,
    requireVest: true,
    requireMask: false,
  });
  const [confThreshold, setConfThreshold] = useState<number>(0.7);

  const [compliance, setCompliance] =
    useState<FrameCompliance>(EMPTY_COMPLIANCE);
  const [telemetry, setTelemetry] = useState<InferenceTelemetry>({
    fps: 0,
    latencyMs: 0,
    backend: "loading",
  });
  const [logs, setLogs] = useState<ViolationLogEntry[]>([]);

  const policyRef = useRef(policy);
  policyRef.current = policy;
  const confRef = useRef(confThreshold);
  confRef.current = confThreshold;
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;

  const stopWebcamTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  // Load YOLOv8n PPE ONNX model once on mount
  useEffect(() => {
    let active = true;
    const engine = new YoloPpeEngine();
    engineRef.current = engine;

    engine
      .load("/models/ppe-yolov8n.onnx")
      .then((backend) => {
        if (!active) return;
        setTelemetry((prev) => ({ ...prev, backend }));
        setModelLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setModelError(
          err instanceof Error
            ? err.message
            : "Tidak dapat menginisialisasi onnxruntime-web di browser ini.",
        );
        setModelLoading(false);
      });

    return () => {
      active = false;
      stopWebcamTracks();
      void engine.dispose();
    };
  }, [stopWebcamTracks]);

  // Attach Live CCTV MP4 or Live Webcam stream whenever sourceMode / facingMode changes
  useEffect(() => {
    let cancelled = false;
    streamEpochRef.current += 1;
    fpsEmaRef.current = 0;
    lastFrameTimeRef.current = 0;
    setCompliance(EMPTY_COMPLIANCE);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    const video = videoRef.current;
    if (!video) return;

    setCameraError(null);
    stopWebcamTracks();

    if (sourceMode === "cctv") {
      video.srcObject = null;
      video.src = "/streams/cctv_construction_live.mp4";
      video.loop = true;
      video.muted = true;
      video.play().catch(() => {
        // Autoplay may require interaction on strict mobile browsers
      });
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Browser ini tidak mendukung akses webcam (getUserMedia). Gunakan Chrome/Edge/Safari modern atau kembali ke Live CCTV Feed.",
      );
      return;
    }

    video.removeAttribute("src");
    video.load();

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.play().catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Izin akses kamera ditolak. Izinkan kamera pada browser Anda lalu klik Live Webcam lagi."
            : "Tidak ditemukan perangkat kamera aktif pada perangkat ini. Anda tetap dapat menggunakan Live CCTV Feed.";
        setCameraError(msg);
      });

    return () => {
      cancelled = true;
      stopWebcamTracks();
    };
  }, [sourceMode, facingMode, stopWebcamTracks]);

  // Pause / resume video playback cleanly
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) {
      streamEpochRef.current += 1;
      lastFrameTimeRef.current = 0;
      video.pause();
    } else if (!cameraError) {
      lastFrameTimeRef.current = 0;
      video.play().catch(() => {});
    }
  }, [isPaused, cameraError]);

  // Continuous real-time inference loop with strict in-flight guard
  useEffect(() => {
    let rafId = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const engine = engineRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        engine &&
        engine.isReady() &&
        video &&
        canvas &&
        !pausedRef.current &&
        !isInferringRef.current &&
        video.readyState >= 2 &&
        video.videoWidth > 0
      ) {
        isInferringRef.current = true;
        const capturedEpoch = streamEpochRef.current;
        const capturedSource = sourceModeRef.current;
        engine
          .detectVideoFrame(video, confRef.current)
          .then(({ detections, latencyMs }) => {
            if (!alive || capturedEpoch !== streamEpochRef.current || pausedRef.current) {
              return;
            }
            const evalRes = evaluateFrameCompliance(
              detections,
              policyRef.current,
            );
            drawDetectionsOnCanvas(canvas, video, evalRes.visibleDetections);
            setCompliance(evalRes);

            const now = performance.now();
            if (lastFrameTimeRef.current > 0) {
              const dt = Math.max(1, now - lastFrameTimeRef.current);
              if (dt <= 2000) {
                const instantFps = 1000 / dt;
                fpsEmaRef.current =
                  fpsEmaRef.current === 0
                    ? instantFps
                    : fpsEmaRef.current * 0.8 + instantFps * 0.2;
              }
            }
            lastFrameTimeRef.current = now;

            setTelemetry({
              fps: Number(fpsEmaRef.current.toFixed(1)),
              latencyMs,
              backend: engine.getBackend(),
            });

            if (evalRes.activeViolations.length > 0) {
              const wallNow = Date.now();
              const newEntries: ViolationLogEntry[] = [];
              let sharedSnapshot: string | null | undefined;

              for (const v of evalRes.activeViolations) {
                if (
                  shouldRecordViolation(
                    v.className,
                    wallNow,
                    lastLoggedRef.current,
                    DEFAULT_VIOLATION_COOLDOWN_MS,
                  )
                ) {
                  if (sharedSnapshot === undefined) {
                    sharedSnapshot = captureSnapshot(video, canvas);
                  }
                  newEntries.push({
                    id: `${wallNow}-${v.className}-${Math.random().toString(36).slice(2, 6)}`,
                    timestampWib: formatWibTime(new Date(wallNow)),
                    sourceLabel:
                      capturedSource === "cctv" ? "Live CCTV" : "Live Webcam",
                    className: v.className,
                    violationLabel: v.labelId,
                    confidencePct: Math.round(v.confidence * 100),
                    workerCount: evalRes.workerCount,
                    snapshotUrl: sharedSnapshot,
                  });
                }
              }

              if (newEntries.length > 0) {
                setLogs((prev) =>
                  [...newEntries, ...prev].slice(0, MAX_VIOLATION_LOG_ENTRIES),
                );
              }
            }
          })
          .catch(() => {
            // Skip single transient frame error without crashing live loop
          })
          .finally(() => {
            isInferringRef.current = false;
          });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      alive = false;
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleExportCsv = () => {
    const headers = [
      "Waktu_WIB",
      "Sumber_Kamera",
      "Jenis_Pelanggaran",
      "Confidence_Pct",
      "Pekerja_Terdeteksi",
    ];
    const rows = logs.map((l) => [
      l.timestampWib,
      l.sourceLabel,
      l.violationLabel,
      l.confidencePct,
      l.workerCount,
    ]);
    const csv = toSafeCsv(headers, rows);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan_pelanggaran_k3_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <TopBar
        sourceMode={sourceMode}
        isPaused={isPaused}
        canExport={logs.length > 0}
        onChangeSource={(mode) => {
          setSourceMode(mode);
          setIsPaused(false);
        }}
        onFlipCamera={() =>
          setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
        }
        onTogglePause={() => setIsPaused((p) => !p)}
        onExportCsv={handleExportCsv}
      />

      <KpiStrip
        compliance={compliance}
        totalLoggedIncidents={logs.length}
      />

      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LiveViewport
            videoRef={videoRef}
            canvasRef={canvasRef}
            sourceMode={sourceMode}
            isPaused={isPaused}
            modelLoading={modelLoading}
            modelError={modelError}
            cameraError={cameraError}
            telemetry={telemetry}
            compliance={compliance}
            onVideoError={() => {
              if (sourceModeRef.current === "cctv") {
                setCameraError(
                  "Stream Live CCTV gagal dimuat. Coba muat ulang halaman atau beralih ke Live Webcam.",
                );
              }
            }}
            onFallbackToCctv={() => {
              setSourceMode("cctv");
              setIsPaused(false);
              setCameraError(null);
            }}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <PolicyControls
            policy={policy}
            confThreshold={confThreshold}
            onChangePolicy={setPolicy}
            onChangeConfidence={setConfThreshold}
          />

          <ViolationLogPanel
            logs={logs}
            onClearLogs={() => {
              setLogs([]);
              lastLoggedRef.current.clear();
            }}
          />
        </div>
      </main>
    </div>
  );
}
