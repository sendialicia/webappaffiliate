"use client"

import { useState } from "react"
import type { Finding } from "@/lib/findings"

export function FindingsFeed({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ov-line)]" style={{ background: "var(--ov-card-gradient)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--ov-fill1)]"
      >
        <span className="flex-none rounded border border-[var(--ov-line)] px-1.5 py-0.5 font-mono text-xs text-[var(--ov-faint)]">
          {findings.length}
        </span>
        <span className="flex-1 text-sm font-semibold text-[var(--ov-soft)]">temuan dari data periode ini</span>
        <span className="text-xs text-[var(--ov-faint)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--ov-line)]">
          {findings.length === 0 && (
            <div className="px-5 py-4 text-sm text-[var(--ov-faint)]">
              Tidak ada temuan yang melewati ambang batas untuk periode dan filter ini.
            </div>
          )}
          {findings.map((f) => (
            <div key={f.id} className="grid grid-cols-[190px_minmax(0,1fr)] gap-4 border-b border-[var(--ov-line)] px-5 py-3 last:border-b-0">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--ov-faint)]">{f.rule}</div>
              <div className="text-sm text-[var(--ov-mut2)]">{f.text}</div>
            </div>
          ))}
          <div className="px-5 py-2.5 text-xs text-[var(--ov-faint)]">
            Seluruhnya dihitung dari data periode aktif dengan aturan tetap di kolom kiri. Tidak ada rekomendasi tindakan.
          </div>
        </div>
      )}
    </div>
  )
}
