"use client";

import { Trash2 } from "lucide-react";
import type { ViolationLogEntry } from "@/lib/types";

interface ViolationLogPanelProps {
  logs: ViolationLogEntry[];
  onClearLogs: () => void;
}

export function ViolationLogPanel({
  logs,
  onClearLogs,
}: ViolationLogPanelProps) {
  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Log Pelanggaran Real-Time
          </h2>
          <p className="text-xs text-slate-600 tabular-nums">
            {logs.length} insiden tercatat sesi ini
          </p>
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClearLogs}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 className="h-3 w-3" />
            Bersihkan
          </button>
        )}
      </div>

      <div className="max-h-[380px] divide-y divide-slate-200 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">
            Belum ada pelanggaran K3 tercatat. Insiden akan muncul otomatis saat
            pekerja tanpa APD wajib terdeteksi di kamera.
          </div>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-2.5 text-xs"
            >
              {entry.snapshotUrl ? (
                <img
                  src={entry.snapshotUrl}
                  alt={`Snapshot ${entry.violationLabel}`}
                  className="h-12 w-20 shrink-0 rounded border border-slate-200 bg-slate-900 object-cover"
                />
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-400">
                  No Frame
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-rose-700">
                    {entry.violationLabel}
                  </span>
                  <span className="shrink-0 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-700 tabular-nums">
                    {entry.confidencePct}%
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                  <span>{entry.sourceLabel}</span>
                  <span className="font-mono">{entry.timestampWib}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
