"use client";

import type { RefObject } from "react";
import { AlertTriangle, CameraOff, Loader2, ShieldAlert } from "lucide-react";
import type {
  FrameCompliance,
  InferenceTelemetry,
  StreamSourceMode,
} from "@/lib/types";

interface LiveViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sourceMode: StreamSourceMode;
  isPaused: boolean;
  modelLoading: boolean;
  modelError: string | null;
  cameraError: string | null;
  telemetry: InferenceTelemetry;
  compliance: FrameCompliance;
  onVideoError: () => void;
  onFallbackToCctv: () => void;
}

export function LiveViewport({
  videoRef,
  canvasRef,
  sourceMode,
  isPaused,
  modelLoading,
  modelError,
  cameraError,
  telemetry,
  compliance,
  onVideoError,
  onFallbackToCctv,
}: LiveViewportProps) {
  const uniqueViolationLabels = Array.from(
    new Set(compliance.activeViolations.map((v) => v.labelId)),
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
      {/* Top Camera HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-200">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${
                isPaused
                  ? "bg-amber-400"
                  : modelLoading || cameraError || modelError
                    ? "bg-slate-400"
                    : "animate-pulse bg-rose-500"
              }`}
            />
            {isPaused ? "PAUSED" : "LIVE"}
          </span>
          <span className="font-medium text-slate-100">
            {sourceMode === "cctv"
              ? "CAM-01 · Area Gudang & Konstruksi (Live Stream)"
              : "Webcam Perangkat (Real-Time Lokal)"}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300 tabular-nums">
          <span>{telemetry.fps.toFixed(1)} FPS</span>
          <span className="text-slate-600">|</span>
          <span>{telemetry.latencyMs} ms</span>
          <span className="text-slate-600">|</span>
          <span className="uppercase text-teal-400">
            ONNX {telemetry.backend}
          </span>
        </div>
      </div>

      {/* Main 16:9 Live Video + Canvas Overlay */}
      <div className="relative aspect-video w-full bg-slate-950">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          loop={sourceMode === "cctv"}
          onError={onVideoError}
          className="h-full w-full object-contain"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />

        {/* Loading Model Overlay */}
        {modelLoading && !modelError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-slate-950/80 px-4 text-center text-slate-100">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
            <div className="text-sm font-medium">
              Memuat Model YOLOv8n PPE (ONNX ~11.7 MB)...
            </div>
            <p className="max-w-md text-xs text-slate-400">
              Inference berjalan 100% lokal di browser Anda tanpa mengirim frame
              kamera ke server.
            </p>
          </div>
        )}

        {/* Model Error Overlay */}
        {modelError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/90 px-4 text-center text-rose-200">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            <div className="text-sm font-semibold">Gagal Memuat Model ONNX</div>
            <p className="max-w-md text-xs text-slate-300">{modelError}</p>
          </div>
        )}

        {/* Webcam Permission / Device Error Overlay */}
        {cameraError && !modelLoading && !modelError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center text-slate-100">
            <CameraOff className="h-7 w-7 text-amber-400" />
            <div className="text-sm font-semibold">
              Kamera Tidak Dapat Diakses
            </div>
            <p className="max-w-md text-xs text-slate-300">{cameraError}</p>
            <button
              type="button"
              onClick={onFallbackToCctv}
              className="rounded-md bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-600"
            >
              Kembali ke Live CCTV Feed
            </button>
          </div>
        )}
      </div>

      {/* Bottom Live Alert / Legend Bar */}
      {compliance.violationCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-700 px-3.5 py-2 text-xs font-medium text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              PERINGATAN K3: Terdeteksi {compliance.violationCount} pelanggaran
              ({uniqueViolationLabels.join(", ")})
            </span>
          </div>
          <span className="text-[11px] text-rose-100">
            Tercatat otomatis ke log insiden
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900 px-3.5 py-2 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Patuh (Helm / Rompi / Masker)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />
              Pelanggaran (Tanpa APD Wajib)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
              Pekerja
            </span>
          </div>
          <span className="text-slate-400">
            Model: YOLOv8n PPE · 640×640 ONNX
          </span>
        </div>
      )}
    </div>
  );
}
