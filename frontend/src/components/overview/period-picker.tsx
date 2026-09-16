"use client"

import { Input } from "@/components/ui/input"
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/date-range"
import { useOverviewFilters } from "@/store/overview-filters"

/** Previous-period range implied by the current range, shown when basis is auto. */
function impliedPrevRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from)
  const days = Math.round((new Date(to).getTime() - fromDate.getTime()) / 86_400_000) + 1
  const prevTo = new Date(fromDate)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return { from: iso(prevFrom), to: iso(prevTo) }
}

function shiftYear(date: string): string {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function PeriodPicker({ compact = false }: { compact?: boolean }) {
  const { preset, from, to, compare, prevFrom, prevTo, setPreset, setCustomRange, setCompare, setPrevRange } =
    useOverviewFilters()

  const resolvedPrev =
    compare === "custom"
      ? { from: prevFrom ?? "", to: prevTo ?? "" }
      : compare === "ly"
        ? { from: shiftYear(from), to: shiftYear(to) }
        : impliedPrevRange(from, to)

  return (
    <div className={`flex flex-wrap items-end gap-3 ${compact ? "" : "gap-4"}`}>
      <div className="flex-none">
        <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
          Current period
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
            {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  background: preset === p ? "var(--ov-fill1)" : "transparent",
                  color: preset === p ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {DATE_PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={from}
                onChange={(e) => setCustomRange(e.target.value, to)}
                className="h-8 w-[142px] bg-[var(--input)] text-xs"
              />
              <span className="text-xs text-[var(--ov-faint)]">→</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setCustomRange(from, e.target.value)}
                className="h-8 w-[142px] bg-[var(--input)] text-xs"
              />
            </div>
          ) : (
            <span className="rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ov-soft)]">
              {from} → {to}
            </span>
          )}
        </div>
      </div>

      <div className="flex-none">
        <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
          Previous period
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
            {(
              [
                { key: "prev", label: "Periode sebelumnya" },
                { key: "ly", label: "Tahun lalu" },
                { key: "custom", label: "Custom" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === "custom") {
                    const implied = impliedPrevRange(from, to)
                    setPrevRange(prevFrom ?? implied.from, prevTo ?? implied.to)
                  } else {
                    setCompare(opt.key)
                  }
                }}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  background: compare === opt.key ? "var(--ov-fill1)" : "transparent",
                  color: compare === opt.key ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {compare === "custom" ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={resolvedPrev.from}
                onChange={(e) => setPrevRange(e.target.value, resolvedPrev.to)}
                className="h-8 w-[142px] bg-[var(--input)] text-xs"
              />
              <span className="text-xs text-[var(--ov-faint)]">→</span>
              <Input
                type="date"
                value={resolvedPrev.to}
                onChange={(e) => setPrevRange(resolvedPrev.from, e.target.value)}
                className="h-8 w-[142px] bg-[var(--input)] text-xs"
              />
            </div>
          ) : (
            <span className="rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ov-soft)]">
              {resolvedPrev.from} → {resolvedPrev.to}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
