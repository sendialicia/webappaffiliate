"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/multi-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CurrentPeriodField,
  PreviousPeriodField,
  impliedPrevRange,
  shiftYear,
} from "@/components/period-picker"
import {
  FilterActions,
  FilterDivider,
  FilterItem,
  FloatingFilterBar,
  pillControlClass,
} from "@/components/filter-shell"
import { DownloadMenu, type DownloadItem } from "@/components/download-menu"
import { useTiktokPidFilters } from "@/store/tiktok-pid-filters"
import type { PidLevel } from "@/types/tiktok-pid"

const FILE_PREFIX = "tiktok-pid"

export const TT_LEVEL_LABELS: Record<PidLevel, string> = {
  category: "Category",
  subcategory: "Sub Category",
  format: "Format",
}

const PID_DIMENSIONS = [
  { key: "pidCategory", label: "PID Category" },
  { key: "pidSubCategory", label: "PID Sub Category" },
  { key: "pidFormat", label: "PID Format" },
] as const

export function TtFilterBar({
  brandOptions,
  dimensionOptions,
  /** True once the in-page scope row has scrolled away, so the active scope merges in here. */
  mergeScope,
  downloads,
  lastSection,
}: {
  brandOptions: string[]
  /** Values available for each PID dimension, keyed the same as the draft. */
  dimensionOptions: Partial<Record<string, string[]>>
  mergeScope: boolean
  downloads: DownloadItem[]
  lastSection?: string | null
}) {
  const {
    brand,
    detail,
    draft,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    setDraftBrand,
    setDraftDetail,
    applyDraft,
    discardDraft,
    setPreset,
    setCustomRange,
    setCompare,
    setTrendGranularity,
    setLevel,
    setScope,
    setPrevRange,
    prevFrom,
    prevTo,
  } = useTiktokPidFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")

  // Nothing refetches until Apply, so the bar has to say when it is holding edits.
  const pending = JSON.stringify([draft.brand, draft.detail]) !== JSON.stringify([brand, detail])
  // Pillar has its own control in the bar, so the popover badge counts only what it holds.
  const activeDimensions = PID_DIMENSIONS.filter((dim) => (draft.detail[dim.key] ?? []).length > 0).length

  const resolvedPrev =
    compare === "custom"
      ? { from: prevFrom ?? "", to: prevTo ?? "" }
      : compare === "ly"
        ? { from: shiftYear(from), to: shiftYear(to) }
        : impliedPrevRange(from, to)

  return (
    <FloatingFilterBar>
      <FilterItem label="Brand">
        <MultiSelect label="Brand" options={brandOptions} selected={draft.brand} onChangeAction={setDraftBrand} />
      </FilterItem>

      {/* Pillar sits in the bar itself rather than under the dimension popover: it is the cut
          readers reach for most, and it is not a product attribute like the others. */}
      <FilterItem label="Pillar">
        <MultiSelect
          label="Pillar"
          options={dimensionOptions.pillar ?? []}
          selected={draft.detail.pillar ?? []}
          onChangeAction={(values) => setDraftDetail("pillar", values)}
        />
      </FilterItem>

      <FilterItem label="Level">
        <Select value={level} onValueChange={(v) => v && setLevel(v as PidLevel)}>
          <SelectTrigger className="h-8 w-32 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => TT_LEVEL_LABELS[v as PidLevel] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="subcategory">Sub Category</SelectItem>
            <SelectItem value="format">Format</SelectItem>
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

      <FilterDivider />

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

      <FilterItem label="Rincian">
        <Popover>
          <PopoverTrigger
            render={
              <button type="button" className={pillControlClass}>
                Kategori & format
                {activeDimensions > 0 && (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--accent-foreground)]">
                    {activeDimensions}
                  </span>
                )}
              </button>
            }
          />
          <PopoverContent className="w-[520px] p-4" align="end">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
                Filter rincian
              </span>
              <span className="text-[12px] text-[var(--ov-faint)]">mengikat seluruh seksi di halaman ini</span>
              {activeDimensions > 0 && (
                <button
                  type="button"
                  onClick={() => PID_DIMENSIONS.forEach((dim) => setDraftDetail(dim.key, []))}
                  className="ml-auto text-[12px] font-semibold text-[var(--accent-foreground)]"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {PID_DIMENSIONS.map((dim) => (
                <div key={dim.key} className="min-w-[150px] flex-1">
                  <div className="mb-1.5 text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
                    {dim.label}
                  </div>
                  <MultiSelect
                    label={dim.label}
                    options={dimensionOptions[dim.key] ?? []}
                    selected={draft.detail[dim.key] ?? []}
                    onChangeAction={(values) => setDraftDetail(dim.key, values)}
                    width="w-full"
                  />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </FilterItem>

      {/* Active scope merges in here once its own row is scrolled past. */}
      {mergeScope && scope.length > 0 && (
        <>
          <FilterDivider />
          <FilterItem label="Cakupan">
            <span className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-foreground)]">
              <span className="max-w-[160px] truncate">{scope.join(", ")}</span>
              <button
                type="button"
                onClick={() => setScope([])}
                title={`Kembali ke seluruh ${TT_LEVEL_LABELS[level].toLowerCase()}`}
                className="text-sm leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </span>
          </FilterItem>
        </>
      )}

      <FilterActions>
        {pending && (
          <button type="button" onClick={discardDraft} className={pillControlClass}>
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={applyDraft}
          disabled={!pending}
          className="flex h-8 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap disabled:opacity-45"
          style={{
            borderColor: pending ? "var(--accent-foreground)" : "var(--ov-line)",
            background: pending ? "var(--accent)" : "transparent",
            color: pending ? "var(--accent-foreground)" : "var(--ov-mut)",
          }}
        >
          Apply
        </button>
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
      </FilterActions>
    </FloatingFilterBar>
  )
}
