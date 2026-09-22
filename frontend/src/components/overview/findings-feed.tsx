"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RULE_CATALOG, type Finding, type Severity } from "@/lib/findings"

const SEVERITY: Record<Severity, { label: string; color: string }> = {
  alert: { label: "Perlu dicek", color: "var(--ov-red)" },
  watch: { label: "Perhatikan", color: "var(--ov-gold)" },
  info: { label: "Info", color: "var(--ov-blue)" },
}

/** Past this many the list folds; findings arrive ordered by severity, then rupiah at stake. */
const VISIBLE = 5

export function FindingsFeed({ findings }: { findings: Finding[] }) {
  // Collapsed by default: the list is a prompt to open, not something to read before the charts.
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const counts = findings.reduce<Partial<Record<Severity, number>>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1
    return acc
  }, {})
  const visible = showAll ? findings : findings.slice(0, VISIBLE)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ov-line)]" style={{ background: "var(--ov-card-gradient)" }}>
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--ov-fill1)]">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-left">
          <span className="text-sm font-semibold text-[var(--ov-soft)]">
            {findings.length} temuan dari data periode ini
          </span>
          {/* The severity split reads even while the list is closed. */}
          {(Object.keys(SEVERITY) as Severity[])
            .filter((s) => counts[s])
            .map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[12.5px] text-[var(--ov-mut2)]">
                <i className="block h-2 w-2 rounded-full" style={{ background: SEVERITY[s].color }} />
                {counts[s]} {SEVERITY[s].label.toLowerCase()}
              </span>
            ))}
        </button>
        <RulesInfo />
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-[var(--ov-faint)]" aria-label={open ? "Tutup temuan" : "Buka temuan"}>
          {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--ov-line)]">
          {findings.length === 0 && (
            <div className="px-5 py-4 text-sm text-[var(--ov-faint)]">
              Tidak ada temuan yang melewati ambang batas untuk periode dan filter ini.
            </div>
          )}
          {visible.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-1 gap-x-4 gap-y-1 border-b border-[var(--ov-line)] px-5 py-3 last:border-b-0 md:grid-cols-[230px_minmax(0,1fr)]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <i className="block h-2 w-2 flex-none rounded-full" style={{ background: SEVERITY[f.severity].color }} />
                  <span className="font-mono text-[11.5px] text-[var(--ov-faint)]">{f.code}</span>
                  <span className="text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">{f.rule}</span>
                </div>
                <div className="mt-0.5 pl-4 font-mono text-[12px] text-[var(--ov-mut2)]">{f.detail}</div>
              </div>
              <div className="text-sm text-[var(--ov-soft)]">{f.text}</div>
            </div>
          ))}
          {findings.length > VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-b border-[var(--ov-line)] px-5 py-2 text-left text-[12.5px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--ov-fill1)]"
            >
              {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${findings.length})`}
            </button>
          )}
          <div className="px-5 py-2.5 text-xs text-[var(--ov-faint)]">
            Diurutkan dari tingkat lalu besar dampak rupiahnya. Semua dihitung dari data periode aktif dengan aturan tetap
            (klik ? untuk daftar aturan). Ini bahan pertimbangan, bukan rekomendasi tindakan.
          </div>
        </div>
      )}
    </div>
  )
}

function RulesInfo() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Aturan temuan"
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[var(--ov-line)] text-xs font-bold text-[var(--ov-mut)] hover:text-[var(--ov-ink)]"
          >
            ?
          </button>
        }
      />
      <PopoverContent className="w-[480px] max-w-[calc(100vw-32px)] p-4" align="end">
        <div className="mb-2 text-[13px] font-bold text-[var(--ov-head)]">Aturan temuan</div>
        <div className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
          {RULE_CATALOG.map((r) => (
            <div key={r.code} className="text-[12.5px] leading-relaxed">
              <span className="font-mono text-[var(--ov-faint)]">{r.code}</span>{" "}
              <span className="font-semibold text-[var(--ov-soft)]">{r.name}</span>
              <div className="text-[var(--ov-mut2)]">{r.rule}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-[var(--ov-line)] pt-2 text-[12px] text-[var(--ov-faint)]">
          <span style={{ color: "var(--ov-red-ink)" }}>●</span> perlu dicek · <span style={{ color: "var(--ov-gold-ink)" }}>●</span>{" "}
          perhatikan · <span style={{ color: "var(--ov-blue)" }}>●</span> info
        </div>
      </PopoverContent>
    </Popover>
  )
}
