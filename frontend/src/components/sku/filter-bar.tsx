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
import { useSkuFilters } from "@/store/sku-filters"
import type { SkuAttributeBase, SkuLevel } from "@/types/sku"

const FILE_PREFIX = "sku"

const LEVEL_NOUNS: Record<SkuLevel, string> = {
  category: "Category",
  subcategory: "Sub Category",
  format: "Format",
}

const BASE_LABELS: Record<SkuAttributeBase, string> = { product: "Product", pid: "PID" }

/**
 * The level reads either family of columns. PRODUCT_* is the barcode's own classification and
 * stays the default; PID_* is how the listing is classified, which is what the Shopee and TikTok
 * PID pages group by — useful when reconciling this page against those.
 */
export function skuLevelLabel(base: SkuAttributeBase, level: SkuLevel): string {
  return `${BASE_LABELS[base]} ${LEVEL_NOUNS[level]}`
}

/** Both dimension sets, the way the existing Tableau SKU page offers them. */
const SKU_DIMENSIONS = [
  { key: "pidCategory", label: "PID Category" },
  { key: "pidSubCategory", label: "PID Sub Category" },
  { key: "pidFormat", label: "PID Format" },
  { key: "productCategory", label: "Product Category" },
  { key: "productSubCategory", label: "Product Sub Category" },
  { key: "productFormat", label: "Product Format" },
] as const

export function SkuFilterBar({
  brandOptions,
  marketplaceOptions,
  bundleTypeOptions,
  dimensionOptions,
  /** True once the in-page scope row has scrolled away, so the active scope merges in here. */
  mergeScope,
  downloads,
  lastSection,
}: {
  brandOptions: string[]
  marketplaceOptions: string[]
  bundleTypeOptions: string[]
  dimensionOptions: Partial<Record<string, string[]>>
  mergeScope: boolean
  downloads: DownloadItem[]
  lastSection?: string | null
}) {
  const {
    brand,
    marketplace,
    bundleType,
    bundleSplit,
    includeGwp,
    detail,
    draft,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    attributeBase,
    scope,
    setDraftBrand,
    setDraftMarketplace,
    setDraftBundleType,
    setDraftBundleSplit,
    setDraftIncludeGwp,
    setDraftDetail,
    applyDraft,
    discardDraft,
    setPreset,
    setCustomRange,
    setCompare,
    setTrendGranularity,
    setLevel,
    setAttributeBase,
    setScope,
    setPrevRange,
    prevFrom,
    prevTo,
  } = useSkuFilters()
  const [copyLabel, setCopyLabel] = useState("Copy link")

  // Nothing refetches until Apply, so the bar has to say when it is holding edits.
  const pending =
    JSON.stringify([draft.brand, draft.marketplace, draft.bundleType, draft.bundleSplit, draft.includeGwp, draft.detail]) !==
    JSON.stringify([brand, marketplace, bundleType, bundleSplit, includeGwp, detail])
  // Pillar has its own control in the bar, so the popover badge counts only what it holds.
  const activeDimensions = SKU_DIMENSIONS.filter((dim) => (draft.detail[dim.key] ?? []).length > 0).length

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

      <FilterItem label="Marketplace">
        <MultiSelect
          label="Marketplace"
          options={marketplaceOptions}
          selected={draft.marketplace}
          onChangeAction={setDraftMarketplace}
        />
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

      <FilterItem label="Atribut">
        <Select
          value={attributeBase}
          onValueChange={(v) => v && setAttributeBase(v as SkuAttributeBase)}
        >
          <SelectTrigger
            className="h-8 w-28 rounded-full bg-[var(--input)] px-3.5 text-[13px]"
            title="Product = klasifikasi SKU-nya sendiri. PID = klasifikasi listing-nya, sama seperti halaman Shopee/TikTok PID."
          >
            <SelectValue>{(v: string) => BASE_LABELS[(v || "product") as SkuAttributeBase]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="pid">PID</SelectItem>
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterItem label="Level">
        <Select value={level} onValueChange={(v) => v && setLevel(v as SkuLevel)}>
          <SelectTrigger className="h-8 w-44 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => skuLevelLabel(attributeBase, v as SkuLevel)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LEVEL_NOUNS) as SkuLevel[]).map((l) => (
              <SelectItem key={l} value={l}>
                {skuLevelLabel(attributeBase, l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterDivider />

      <FilterItem label="Bundle dipecah">
        <Select
          value={draft.bundleSplit ? "true" : "false"}
          onValueChange={(v) => v && setDraftBundleSplit(v === "true")}
        >
          <SelectTrigger className="h-8 w-24 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => (v === "false" ? "False" : "True")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      </FilterItem>

      <FilterItem label="Bundle type">
        <MultiSelect
          label="Bundle type"
          options={bundleTypeOptions}
          selected={draft.bundleType}
          onChangeAction={setDraftBundleType}
        />
      </FilterItem>

      <FilterItem label="Include GWP">
        <Select
          value={draft.includeGwp ? "true" : "false"}
          onValueChange={(v) => v && setDraftIncludeGwp(v === "true")}
        >
          <SelectTrigger className="h-8 w-24 rounded-full bg-[var(--input)] px-3.5 text-[13px]">
            <SelectValue>{(v: string) => (v === "true" ? "True" : "False")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">False</SelectItem>
            <SelectItem value="true">True</SelectItem>
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
          <PopoverContent className="w-[560px] p-4" align="end">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
                Filter rincian
              </span>
              <span className="text-[12px] text-[var(--ov-faint)]">mengikat seluruh seksi di halaman ini</span>
              {activeDimensions > 0 && (
                <button
                  type="button"
                  onClick={() => SKU_DIMENSIONS.forEach((dim) => setDraftDetail(dim.key, []))}
                  className="ml-auto text-[12px] font-semibold text-[var(--accent-foreground)]"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {SKU_DIMENSIONS.map((dim) => (
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
                title={`Kembali ke seluruh ${skuLevelLabel(attributeBase, level).toLowerCase()}`}
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
