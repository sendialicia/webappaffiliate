"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DetailFilterSelects, activeDetailCount } from "@/components/overview/detail-filters"
import { FilterDivider, FilterItem, FloatingFilterBar, pillControlClass } from "@/components/filter-shell"
import { DownloadMenu, type DownloadItem } from "@/components/download-menu"
import {
  CurrentPeriodField,
  PreviousPeriodField,
  impliedPrevRange,
  shiftYear,
} from "@/components/period-picker"
import { useOverviewFilters } from "@/store/overview-filters"
import type { FilterOption } from "@/types/overview"

const ALL = "__all__"
const FILE_PREFIX = "overview"

export function FilterBar({
  brandOptions,
  marketplaceOptions,
  dimensionOptions,
  /** True once the in-page detail row has scrolled away, so it merges in here. */
  mergeDetail,
  downloads,
}: {
  brandOptions: string[]
  marketplaceOptions: string[]
  dimensionOptions: FilterOption[]
  mergeDetail: boolean
  downloads: DownloadItem[]
}) {
  const {
    brand,
    marketplace,
    detail,
    preset,
    from,
    to,
    compare,
    prevFrom,
    prevTo,
    setBrand,
    setMarketplace,
    setPreset,
    setCustomRange,
    setCompare,
    setPrevRange,
    clearDetailFilters,
  } = useOverviewFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")
  const activeCount = activeDetailCount(detail)

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

      <FilterItem label="Marketplace" grow>
        <Select value={marketplace ?? ALL} onValueChange={(v) => v && setMarketplace(v === ALL ? null : v)}>
          <SelectTrigger className="h-8 w-full rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => (v === ALL || !v ? "(All)" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>(All)</SelectItem>
            {marketplaceOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
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

      {/* Detail filters merge in here once their own row is scrolled past. */}
      {mergeDetail && (
        <>
          <FilterDivider />
          <FilterItem label="Rincian">
            <Popover>
              <PopoverTrigger
                render={
                  <button type="button" className={pillControlClass}>
                    Filter lainnya
                    {activeCount > 0 && (
                      <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-foreground)]">
                        {activeCount}
                      </span>
                    )}
                  </button>
                }
              />
              <PopoverContent className="w-[520px] p-4" align="end">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
                    Filter rincian
                  </span>
                  <span className="text-[11px] text-[var(--ov-faint)]">mengikat Summary dan seksi di bawahnya</span>
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={clearDetailFilters}
                      className="ml-auto text-[11px] font-semibold text-[var(--accent-foreground)]"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <DetailFilterSelects options={dimensionOptions} compact />
                </div>
              </PopoverContent>
            </Popover>
          </FilterItem>
        </>
      )}

      <div className="ml-auto flex flex-none items-center gap-1.5 pl-1.5">
        <DownloadMenu items={downloads} filePrefix={FILE_PREFIX} />
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
