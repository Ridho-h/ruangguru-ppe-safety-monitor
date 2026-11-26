"use client";

import type { SafetyPolicy } from "@/lib/types";

interface PolicyControlsProps {
  policy: SafetyPolicy;
  confThreshold: number;
  onChangePolicy: (next: SafetyPolicy) => void;
  onChangeConfidence: (val: number) => void;
}

export function PolicyControls({
  policy,
  confThreshold,
  onChangePolicy,
  onChangeConfidence,
}: PolicyControlsProps) {
  const toggles: Array<{
    key: keyof SafetyPolicy;
    label: string;
    desc: string;
  }> = [
    {
      key: "requireHardhat",
      label: "Wajib Helm K3 (Hardhat)",
      desc: "Tandai pelanggaran bila pekerja tanpa helm proyek",
    },
    {
      key: "requireVest",
      label: "Wajib Rompi K3 (Safety Vest)",
      desc: "Tandai pelanggaran bila pekerja tanpa rompi reflektif",
    },
    {
      key: "requireMask",
      label: "Wajib Masker (Area Debu/Kimia)",
      desc: "Opsional untuk zona produksi atau area berdebu",
    },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Kebijakan K3 &amp; Sensitivitas Model
      </h2>
      <p className="mt-0.5 text-xs text-slate-600">
        Atur APD wajib sesuai zona kerja dan ambang keyakinan deteksi YOLO.
      </p>

      <div className="mt-3.5 space-y-2.5">
        {toggles.map((item) => {
          const checked = policy[item.key];
          return (
            <label
              key={item.key}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
            >
              <div>
                <div className="text-xs font-medium text-slate-900">
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-500">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChangePolicy({ ...policy, [item.key]: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700"
              />
            </label>
          );
        })}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3.5">
        <div className="flex items-center justify-between text-xs">
          <label
            htmlFor="conf-threshold-slider"
            className="font-medium text-slate-800"
          >
            Ambang Keyakinan (Confidence)
          </label>
          <span className="font-mono font-semibold text-teal-800 tabular-nums">
            {Math.round(confThreshold * 100)}%
          </span>
        </div>
        <input
          id="conf-threshold-slider"
          type="range"
          min={0.25}
          max={0.85}
          step={0.05}
          value={confThreshold}
          onChange={(e) => onChangeConfidence(Number(e.target.value))}
          className="mt-2 w-full accent-teal-700"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums">
          <span>25% (Lebih Sensitif)</span>
          <span>85% (Lebih Ketat)</span>
        </div>
      </div>
    </section>
  );
}
