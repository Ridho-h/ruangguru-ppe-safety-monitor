"use client";

import type { FrameCompliance } from "@/lib/types";

interface KpiStripProps {
  compliance: FrameCompliance;
  totalLoggedIncidents: number;
}

export function KpiStrip({
  compliance,
  totalLoggedIncidents,
}: KpiStripProps) {
  const score = compliance.complianceScore;
  const scoreColor =
    score === null
      ? "text-slate-700"
      : score >= 85
        ? "text-emerald-700"
        : score >= 60
          ? "text-amber-700"
          : "text-rose-700";

  const scoreBadge =
    score === null
      ? { text: "Siaga", cls: "bg-slate-100 text-slate-600" }
      : score >= 85
        ? { text: "Aman", cls: "bg-emerald-50 text-emerald-700" }
        : score >= 60
          ? { text: "Waspada", cls: "bg-amber-50 text-amber-800" }
          : { text: "Kritis", cls: "bg-rose-50 text-rose-700" };

  return (
    <section
      aria-label="Ringkasan Metrik K3 Real-Time"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <div className="px-4 py-3.5 sm:px-6">
          <div className="text-xs font-medium text-slate-600">
            Skor Kepatuhan K3 (Frame Aktif)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`tabular-nums text-2xl font-semibold ${scoreColor}`}
            >
              {score === null ? "—" : `${score}%`}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${scoreBadge.cls}`}
            >
              {scoreBadge.text}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
            APD Patuh terdeteksi: {compliance.compliantCount}
          </div>
        </div>

        <div className="px-4 py-3.5 sm:px-6">
          <div className="text-xs font-medium text-slate-600">
            Pekerja Terdeteksi
          </div>
          <div className="mt-1 tabular-nums text-2xl font-semibold text-slate-900">
            {compliance.workerCount}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Dalam jangkauan kamera saat ini
          </div>
        </div>

        <div className="px-4 py-3.5 sm:px-6">
          <div className="text-xs font-medium text-slate-600">
            Pelanggaran Aktif Saat Ini
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`tabular-nums text-2xl font-semibold ${
                compliance.violationCount > 0
                  ? "text-rose-700"
                  : "text-emerald-700"
              }`}
            >
              {compliance.violationCount}
            </span>
            {compliance.violationCount > 0 && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                Perlu Tindakan
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Sesuai aturan wajib yang aktif
          </div>
        </div>

        <div className="px-4 py-3.5 sm:px-6">
          <div className="text-xs font-medium text-slate-600">
            Total Insiden Tercatat
          </div>
          <div className="mt-1 tabular-nums text-2xl font-semibold text-slate-900">
            {totalLoggedIncidents}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Cooldown anti-spam 3 detik per pelanggaran
          </div>
        </div>
      </div>
    </section>
  );
}
