import type { ProgressRow } from "@/types/overview"
import { formatPercent, formatRp } from "@/lib/format"

export function ProgressBars({ title, rows }: { title: string; rows: ProgressRow[] }) {
  return (
    <div
      className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="mb-4 text-lg font-semibold font-(family-name:--font-archivo)">{title}</div>
      <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
        {rows.map((r) => {
          const pct = Math.min(Math.max(r.pct, 0), 1)
          return (
            <div key={r.name} className="grid grid-cols-[88px_1fr] items-center gap-3">
              <div className="truncate text-right text-sm font-semibold">{r.name}</div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-[var(--ov-soft)]">
                  <span>{formatPercent(r.pct, 0)}</span>
                  <span className="text-[var(--ov-red-ink)]">
                    ({formatRp(Math.max(r.target - r.actual, 0))} to go)
                  </span>
                  <span className="ml-auto text-[var(--ov-faint)]">
                    {formatRp(r.actual)} / {formatRp(r.target)}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-[var(--ov-track)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${pct * 100}%`,
                      background: "linear-gradient(90deg,var(--ov-gold),var(--ov-gold-deep))",
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
