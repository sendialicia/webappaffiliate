"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/date-range"
import { useShopeePidFilters } from "@/store/shopee-pid-filters"
import type { PidLevel } from "@/types/shopee-pid"

const ALL = "__all__"

export const LEVEL_LABELS: Record<PidLevel, string> = {
  category: "Category",
  subcategory: "Sub Category",
  format: "Format",
}

export function FilterBar({
  brandOptions,
  /** True once the in-page scope row has scrolled away, so the active scope merges in here. */
  mergeScope,
}: {
  brandOptions: string[]
  mergeScope: boolean
}) {
  const {
    brand,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    setBrand,
    setPreset,
    setCustomRange,
    setCompare,
    setTrendGranularity,
    setLevel,
    setScope,
  } = useShopeePidFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--ov-line)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur md:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[150px] flex-1">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            Brand Name
          </div>
          <Select value={brand ?? ALL} onValueChange={(v) => v && setBrand(v === ALL ? null : v)}>
            <SelectTrigger className="h-8 w-full bg-[var(--input)] text-[13px]">
              <SelectValue>{(v: string) => (v === ALL || !v ? "(All)" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={ALL}>(All)</SelectItem>
              {brandOptions.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Level</div>
          <Select value={level} onValueChange={(v) => v && setLevel(v as PidLevel)}>
            <SelectTrigger className="h-8 w-36 bg-[var(--input)] text-[13px]">
              <SelectValue>{(v: string) => LEVEL_LABELS[v as PidLevel] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="subcategory">Sub Category</SelectItem>
              <SelectItem value="format">Format</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            Tren Date
          </div>
          <Select
            value={trendGranularity}
            onValueChange={(v) => v && setTrendGranularity(v as "day" | "week" | "month")}
          >
            <SelectTrigger className="h-8 w-24 bg-[var(--input)] text-[13px]">
              <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              // The scope chip takes this slot's width when it merges in, so the resolved
              // range steps aside to keep the bar on one row.
              !(mergeScope && scope) && (
                <span className="rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ov-soft)]">
                  {from} → {to}
                </span>
              )
            )}
          </div>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            Bandingkan
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
            {(["prev", "ly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCompare(c)}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
                style={{
                  background: compare === c ? "var(--ov-fill1)" : "transparent",
                  color: compare === c ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {c === "prev" ? "vs prev" : "vs LY"}
              </button>
            ))}
          </div>
        </div>

        {/* Active scope merges in here once its own row is scrolled past. */}
        {mergeScope && scope && (
          <div className="flex-none">
            <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
              Cakupan
            </div>
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-xs font-semibold text-[var(--accent-foreground)]">
              <span className="max-w-[180px] truncate">{scope}</span>
              <button
                type="button"
                onClick={() => setScope(null)}
                title={`Kembali ke seluruh ${LEVEL_LABELS[level].toLowerCase()}`}
                className="text-sm leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="ml-auto flex flex-none flex-col gap-1.5">
          <div className="text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Tampilan ini</div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href)
              setCopyLabel("Copied!")
              setTimeout(() => setCopyLabel("Copy link"), 1500)
            }}
            className="flex h-8 items-center gap-2 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-3 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
