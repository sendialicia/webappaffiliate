"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CurrentPeriodField,
  PreviousPeriodField,
  impliedPrevRange,
  shiftYear,
} from "@/components/period-picker"
import { FilterDivider, FilterItem, FloatingFilterBar, pillControlClass } from "@/components/filter-shell"
import { DownloadMenu, type DownloadItem } from "@/components/download-menu"
import { useShopeePidFilters } from "@/store/shopee-pid-filters"
import type { PidLevel } from "@/types/shopee-pid"

const ALL = "__all__"
const FILE_PREFIX = "shopee-pid"

export const LEVEL_LABELS: Record<PidLevel, string> = {
  category: "Category",
  subcategory: "Sub Category",
  format: "Format",
}

export function FilterBar({
  brandOptions,
  /** True once the in-page scope row has scrolled away, so the active scope merges in here. */
  mergeScope,
  downloads,
  lastSection,
}: {
  brandOptions: string[]
  mergeScope: boolean
  downloads: DownloadItem[]
  lastSection?: string | null
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
    setPrevRange,
    prevFrom,
    prevTo,
  } = useShopeePidFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")

  const resolvedPrev =
    compare === "custom"
      ? { from: prevFrom ?? "", to: prevTo ?? "" }
      : compare === "ly"
        ? { from: shiftYear(from), to: shiftYear(to) }
        : impliedPrevRange(from, to)

  return (
    <FloatingFilterBar>
      <FilterItem label="Brand" grow>
        <Select value={brand ?? ALL} onValueChange={(v) => v && setBrand(v === ALL ? null : v)}>
          <SelectTrigger className="h-8 w-full rounded-full bg-[var(--input)] px-3.5 text-[13px]">
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
      </FilterItem>

      <FilterDivider />

      <FilterItem label="Level">
        <Select value={level} onValueChange={(v) => v && setLevel(v as PidLevel)}>
          <SelectTrigger className="h-8 w-32 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => LEVEL_LABELS[v as PidLevel] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="subcategory">Sub Category</SelectItem>
            <SelectItem value="format">Format</SelectItem>
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterItem label="Tren">
        <Select
          value={trendGranularity}
          onValueChange={(v) => v && setTrendGranularity(v as "day" | "week" | "month")}
        >
          <SelectTrigger className="h-8 w-24 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterDivider />

      <FilterItem label="Periode">
        <CurrentPeriodField
          preset={preset}
          from={from}
          to={to}
          onPresetAction={setPreset}
          onRangeAction={setCustomRange}
        />
      </FilterItem>

      <FilterItem label="vs">
        <PreviousPeriodField
          basis={compare}
          from={from}
          to={to}
          resolvedFrom={resolvedPrev.from}
          resolvedTo={resolvedPrev.to}
          onBasisAction={setCompare}
          onRangeAction={setPrevRange}
        />
      </FilterItem>

      {/* Active scope merges in here once its own row is scrolled past. */}
      {mergeScope && scope && (
        <>
          <FilterDivider />
          <FilterItem label="Cakupan">
            <span className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-foreground)]">
              <span className="max-w-[160px] truncate">{scope}</span>
              <button
                type="button"
                onClick={() => setScope(null)}
                title={`Kembali ke seluruh ${LEVEL_LABELS[level].toLowerCase()}`}
                className="text-sm leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </span>
          </FilterItem>
        </>
      )}

      <div className="ml-auto flex flex-none items-center gap-1.5 pl-1.5">
        <DownloadMenu items={downloads} filePrefix={FILE_PREFIX} highlightId={lastSection} />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href)
            setCopyLabel("Copied!")
            setTimeout(() => setCopyLabel("Copy link"), 1500)
          }}
          className={pillControlClass}
        >
          {copyLabel}
        </button>
      </div>
    </FloatingFilterBar>
  )
}
