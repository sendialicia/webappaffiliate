"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/multi-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DetailFilterSelects, activeDetailCount } from "@/components/overview/detail-filters"
import {
  FilterActions,
  FilterDivider,
  FilterItem,
  FloatingFilterBar,
  pillControlClass,
} from "@/components/filter-shell"
import { DownloadMenu, type DownloadItem } from "@/components/download-menu"
import {
  CurrentPeriodField,
  PreviousPeriodField,
  impliedPrevRange,
  shiftYear,
} from "@/components/period-picker"
import { useOverviewFilters } from "@/store/overview-filters"
import type { FilterOption } from "@/types/overview"

const FILE_PREFIX = "overview"

export function FilterBar({
  brandOptions,
  marketplaceOptions,
  dimensionOptions,
  downloads,
  lastSection,
  showSectionControls = true,
}: {
  brandOptions: string[]
  marketplaceOptions: string[]
  dimensionOptions: FilterOption[]
  downloads: DownloadItem[]
  lastSection?: string | null
  /**
   * Tren and the dimension filters bind Summary and the sections below it, not the performance
   * and progress blocks above, so the page only shows them once Summary has been reached.
   */
  showSectionControls?: boolean
}) {
  const {
    brand,
    marketplace,
    detail,
    draft,
    preset,
    from,
    to,
    compare,
    prevFrom,
    prevTo,
    trendGranularity,
    setDraftBrand,
    setDraftMarketplace,
    setDraftDetail,
    setPreset,
    setCustomRange,
    setCompare,
    setPrevRange,
    setTrendGranularity,
    applyDraft,
    discardDraft,
  } = useOverviewFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")
  // Pillar has its own control in the bar; the popover and its badge hold the rest.
  const pillarOptions = dimensionOptions.find((d) => d.key === "pillar")?.values ?? []
  const popoverOptions = dimensionOptions.filter((d) => d.key !== "pillar")
  const activeCount = activeDetailCount({ ...draft.detail, pillar: [] })

  // Nothing refetches until Apply, so the bar has to say when it is holding edits.
  const pending =
    JSON.stringify([draft.brand, draft.marketplace, draft.detail]) !==
    JSON.stringify([brand, marketplace, detail])

  const resolvedPrev =
    compare === "custom"
      ? { from: prevFrom ?? "", to: prevTo ?? "" }
      : compare === "ly"
        ? { from: shiftYear(from), to: shiftYear(to) }
        : impliedPrevRange(from, to)

  return (
    <FloatingFilterBar>
      <FilterItem label="Brand">
        <MultiSelect
          label="Brand"
          options={brandOptions}
          selected={draft.brand}
          onChangeAction={setDraftBrand}
        />
      </FilterItem>

      <FilterItem label="Marketplace">
        <MultiSelect
          label="Marketplace"
          options={marketplaceOptions}
          selected={draft.marketplace}
          onChangeAction={setDraftMarketplace}
        />
      </FilterItem>

      <FilterItem label="Pillar">
        <MultiSelect
          label="Pillar"
          options={pillarOptions}
          selected={draft.detail.pillar ?? []}
          onChangeAction={(values) => setDraftDetail("pillar", values)}
        />
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

      {showSectionControls && (
        <>
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
                    {activeCount > 0 && (
                      <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--accent-foreground)]">
                        {activeCount}
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
                  <span className="text-[12px] text-[var(--ov-faint)]">mengikat Summary dan seksi di bawahnya</span>
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={() => popoverOptions.forEach((opt) => setDraftDetail(opt.key, []))}
                      className="ml-auto text-[12px] font-semibold text-[var(--accent-foreground)]"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <DetailFilterSelects options={popoverOptions} />
                </div>
              </PopoverContent>
            </Popover>
      </FilterItem>
        </>
      )}

      <FilterActions>
        {pending && (
          <button
            type="button"
            onClick={discardDraft}
            className={pillControlClass}
            title="Kembalikan ke filter yang sedang aktif"
          >
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
