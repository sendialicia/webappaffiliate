import type { ProgressRow } from "@/types/overview"
import { formatPercent } from "@/lib/format"
import { MARKETPLACE_COLORS } from "@/components/overview/composition-table"
import { Num } from "@/components/num"

export function ProgressBars({ title, rows }: { title: string; rows: ProgressRow[] }) {
  // Furthest along first, so the list reads as a ranking; rows without a target (pct 0) sink.
  const sorted = [...rows].sort((a, b) => b.pct - a.pct || b.actual - a.actual)
  return (
    <div
      className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="mb-4 text-lg font-semibold font-(family-name:--font-archivo)">{title}</div>
      <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
        {sorted.map((r) => {
          const pct = Math.min(Math.max(r.pct, 0), 1)
          return (
            <div key={r.name} className="grid grid-cols-[88px_1fr] items-center gap-3">
              <div className="truncate text-right text-sm font-semibold">{r.name}</div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-[var(--ov-soft)]">
                  <span>{formatPercent(r.pct, 0)}</span>
                  <span className="text-[var(--ov-red-ink)]">
                    (<Num money value={Math.max(r.target - r.actual, 0)} /> to go)
                  </span>
                  <span className="ml-auto text-[var(--ov-faint)]">
                    <Num money value={r.actual} /> / <Num money value={r.target} />
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-[var(--ov-track)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${pct * 100}%`,
                      // Marketplace rows wear their identity colour; brands keep the gold bar.
                      background: MARKETPLACE_COLORS[r.name.toLowerCase()] ?? "linear-gradient(90deg,var(--ov-gold),var(--ov-gold-deep))",
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
