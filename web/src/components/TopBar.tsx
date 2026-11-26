"use client";

import {
  Camera,
  Download,
  Pause,
  Play,
  RefreshCw,
  Video,
} from "lucide-react";
import type { StreamSourceMode } from "@/lib/types";

interface TopBarProps {
  sourceMode: StreamSourceMode;
  isPaused: boolean;
  canExport: boolean;
  onChangeSource: (mode: StreamSourceMode) => void;
  onFlipCamera: () => void;
  onTogglePause: () => void;
  onExportCsv: () => void;
}

export function TopBar({
  sourceMode,
  isPaused,
  canExport,
  onChangeSource,
  onFlipCamera,
  onTogglePause,
  onExportCsv,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            Workplace Safety (K3) PPE Monitor
          </h1>
          <p className="text-xs text-slate-600">
            Deteksi kepatuhan APD real-time di browser menggunakan YOLOv8n ONNX
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => onChangeSource("cctv")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${
                sourceMode === "cctv"
                  ? "bg-teal-700 text-white"
                  : "text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Live CCTV Feed
            </button>
            <button
              type="button"
              onClick={() => onChangeSource("webcam")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${
                sourceMode === "webcam"
                  ? "bg-teal-700 text-white"
                  : "text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Live Webcam
            </button>
          </div>

          {sourceMode === "webcam" && (
            <button
              type="button"
              onClick={onFlipCamera}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
              Ganti Kamera
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            {isPaused ? (
              <>
                <Play className="h-3.5 w-3.5 text-teal-700" />
                Lanjutkan
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 text-slate-600" />
                Jeda Stream
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!canExport}
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            Export Log CSV
          </button>
        </div>
      </div>
    </header>
  );
}
