"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DetailFilterSelects, activeDetailCount } from "@/components/overview/detail-filters"
import {
  CurrentPeriodField,
  PreviousPeriodField,
  impliedPrevRange,
  shiftYear,
} from "@/components/period-picker"
import { useOverviewFilters } from "@/store/overview-filters"
import type { FilterOption } from "@/types/overview"

const ALL = "__all__"

export function FilterBar({
  brandOptions,
  marketplaceOptions,
  dimensionOptions,
  /** True once the in-page detail row has scrolled away, so it merges in here. */
  mergeDetail,
}: {
  brandOptions: string[]
  marketplaceOptions: string[]
  dimensionOptions: FilterOption[]
  mergeDetail: boolean
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

        <div className="min-w-[140px] flex-1">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            Marketplace
          </div>
          <Select value={marketplace ?? ALL} onValueChange={(v) => v && setMarketplace(v === ALL ? null : v)}>
            <SelectTrigger className="h-8 w-full bg-[var(--input)] text-[13px]">
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
        </div>

        <CurrentPeriodField
          preset={preset}
          from={from}
          to={to}
          onPresetAction={setPreset}
          onRangeAction={setCustomRange}
        />
        <PreviousPeriodField
          basis={compare}
          from={from}
          to={to}
          resolvedFrom={resolvedPrev.from}
          resolvedTo={resolvedPrev.to}
          onBasisAction={setCompare}
          onRangeAction={setPrevRange}
        />

        {/* Detail filters merge in here once their own row is scrolled past. */}
        {mergeDetail && (
          <div className="flex-none">
            <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
              Filter rincian
            </div>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-8 items-center gap-2 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-3 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
                  >
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
                  <span className="text-[11px] text-[var(--ov-faint)]">
                    mengikat Summary dan seksi di bawahnya
                  </span>
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
