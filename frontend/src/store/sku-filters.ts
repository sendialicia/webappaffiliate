import { create } from "zustand"
import { type DatePreset, computePresetRange } from "@/lib/date-range"
import type { SkuAttributeBase, SkuLevel, SkuQuadrantPreset } from "@/types/sku"
import type { DetailFilterKey, DetailFilters } from "@/types/overview"
import type { CompareBasis, TrendGranularity } from "@/store/overview-filters"

/** What the filter bar is editing; nothing refetches until it is applied. */
export interface SkuFilterDraft {
  brand: string[]
  marketplace: string[]
  bundleType: string[]
  bundleSplit: boolean
  includeGwp: boolean
  detail: DetailFilters
}

interface SkuState {
  brand: string[]
  marketplace: string[]
  bundleType: string[]
  /** "Bundle Dipecah Flag" on the Tableau page; true breaks bundles into component SKUs. */
  bundleSplit: boolean
  includeGwp: boolean
  detail: DetailFilters
  draft: SkuFilterDraft
  preset: DatePreset
  from: string
  to: string
  compare: CompareBasis
  trendGranularity: TrendGranularity
  level: SkuLevel
  /** Which family of attribute columns `level` reads — PRODUCT_* or PID_*. */
  attributeBase: SkuAttributeBase
  scope: string[]
  selectedBarcodes: string[]
  countFilter: "all" | "cross" | "shopee" | "tiktok"
  quadrantSelection: string[]
  creatorLimit: number
  quadrant: SkuQuadrantPreset
  excludeOutliers: boolean
  search: string
  creatorManaged: boolean | null
  prevFrom: string | null
  prevTo: string | null
  setDraftBrand: (brand: string[]) => void
  setDraftMarketplace: (marketplace: string[]) => void
  setDraftBundleType: (bundleType: string[]) => void
  setDraftBundleSplit: (bundleSplit: boolean) => void
  setDraftIncludeGwp: (includeGwp: boolean) => void
  setDraftDetail: (key: DetailFilterKey, values: string[]) => void
  clearDraftDetail: () => void
  applyDraft: () => void
  discardDraft: () => void
  setPreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  setCompare: (compare: CompareBasis) => void
  setTrendGranularity: (granularity: TrendGranularity) => void
  setLevel: (level: SkuLevel) => void
  setAttributeBase: (base: SkuAttributeBase) => void
  setScope: (scope: string[]) => void
  toggleScope: (value: string) => void
  setSelectedBarcodes: (barcodes: string[]) => void
  toggleSelectedBarcode: (barcode: string) => void
  setCountFilter: (filter: SkuState["countFilter"]) => void
  setQuadrantSelection: (barcodes: string[]) => void
  setCreatorLimit: (limit: number) => void
  setQuadrant: (quadrant: SkuQuadrantPreset) => void
  setExcludeOutliers: (exclude: boolean) => void
  setSearch: (search: string) => void
  setCreatorManaged: (managed: boolean | null) => void
  setPrevRange: (from: string, to: string) => void
  hydrateFromParams: (params: URLSearchParams) => void
}

const defaultRange = computePresetRange("mtd")

const emptyDraft: SkuFilterDraft = {
  brand: [],
  marketplace: [],
  bundleType: [],
  // Same defaults as the Tableau page: bundles split, GWP excluded.
  bundleSplit: true,
  includeGwp: false,
  detail: {},
}

export const useSkuFilters = create<SkuState>((set) => ({
  brand: [],
  marketplace: [],
  bundleType: [],
  bundleSplit: true,
  includeGwp: false,
  detail: {},
  draft: { ...emptyDraft },
  preset: "mtd",
  from: defaultRange.from,
  to: defaultRange.to,
  compare: "prev",
  trendGranularity: "day",
  level: "category",
  attributeBase: "product",
  scope: [],
  selectedBarcodes: [],
  countFilter: "all",
  quadrantSelection: [],
  creatorLimit: 20,
  quadrant: "shopee-tiktok",
  excludeOutliers: false,
  search: "",
  creatorManaged: null,
  prevFrom: null,
  prevTo: null,

  setDraftBrand: (brand) => set((s) => ({ draft: { ...s.draft, brand } })),
  setDraftMarketplace: (marketplace) => set((s) => ({ draft: { ...s.draft, marketplace } })),
  setDraftBundleType: (bundleType) => set((s) => ({ draft: { ...s.draft, bundleType } })),
  setDraftBundleSplit: (bundleSplit) => set((s) => ({ draft: { ...s.draft, bundleSplit } })),
  setDraftIncludeGwp: (includeGwp) => set((s) => ({ draft: { ...s.draft, includeGwp } })),
  setDraftDetail: (key, values) =>
    set((s) => {
      const detail = { ...s.draft.detail }
      if (values.length > 0) detail[key] = values
      else delete detail[key]
      return { draft: { ...s.draft, detail } }
    }),
  clearDraftDetail: () => set((s) => ({ draft: { ...s.draft, detail: {} } })),
  applyDraft: () =>
    set((s) => ({
      brand: s.draft.brand,
      marketplace: s.draft.marketplace,
      bundleType: s.draft.bundleType,
      bundleSplit: s.draft.bundleSplit,
      includeGwp: s.draft.includeGwp,
      detail: s.draft.detail,
      // The two bundle populations have different barcodes, so a held selection would dangle.
      ...(s.draft.bundleSplit !== s.bundleSplit ? { selectedBarcodes: [], quadrantSelection: [] } : {}),
    })),
  discardDraft: () =>
    set((s) => ({
      draft: {
        brand: s.brand,
        marketplace: s.marketplace,
        bundleType: s.bundleType,
        bundleSplit: s.bundleSplit,
        includeGwp: s.includeGwp,
        detail: s.detail,
      },
    })),
  setPreset: (preset) =>
    set(preset === "custom" ? { preset } : { preset, ...computePresetRange(preset) }),
  setCustomRange: (from, to) => set({ preset: "custom", from, to }),
  setCompare: (compare) => set({ compare }),
  setTrendGranularity: (trendGranularity) => set({ trendGranularity }),
  // Changing level invalidates a scope picked under the previous level.
  setLevel: (level) => set({ level, scope: [] }),
  // The two families have different values, so a scope picked under one is meaningless under the other.
  setAttributeBase: (attributeBase) => set({ attributeBase, scope: [] }),
  setScope: (scope) => set({ scope }),
  toggleScope: (value) =>
    set((s) => ({
      scope: s.scope.includes(value) ? s.scope.filter((v) => v !== value) : [...s.scope, value],
    })),
  setSelectedBarcodes: (selectedBarcodes) => set({ selectedBarcodes }),
  toggleSelectedBarcode: (barcode) =>
    set((s) => ({
      selectedBarcodes: s.selectedBarcodes.includes(barcode)
        ? s.selectedBarcodes.filter((b) => b !== barcode)
        : [...s.selectedBarcodes, barcode],
    })),
  setCountFilter: (countFilter) =>
    set((s) => ({ countFilter: s.countFilter === countFilter ? "all" : countFilter })),
  setQuadrantSelection: (quadrantSelection) => set({ quadrantSelection }),
  setCreatorLimit: (creatorLimit) => set({ creatorLimit }),
  setQuadrant: (quadrant) => set({ quadrant }),
  setExcludeOutliers: (excludeOutliers) => set({ excludeOutliers }),
  setSearch: (search) => set({ search }),
  setCreatorManaged: (creatorManaged) => set({ creatorManaged }),
  setPrevRange: (prevFrom, prevTo) => set({ compare: "custom", prevFrom, prevTo }),

  hydrateFromParams: (params) =>
    set((state) => {
      const preset = (params.get("preset") as DatePreset) || state.preset
      const range = preset === "custom" ? null : computePresetRange(preset)
      const managed = params.get("managed")
      const brand = splitParam(params.get("brand")) ?? state.brand
      const marketplace = splitParam(params.get("marketplace")) ?? state.marketplace
      const bundleType = splitParam(params.get("bundleType")) ?? state.bundleType
      const bundleSplit = params.get("split") === null ? state.bundleSplit : params.get("split") !== "0"
      const includeGwp = params.get("gwp") === "1" ? true : state.includeGwp
      const detail = hydrateDetail(params, state.detail)
      const limit = Number(params.get("crLimit"))

      return {
        brand,
        marketplace,
        bundleType,
        bundleSplit,
        includeGwp,
        detail,
        draft: { brand, marketplace, bundleType, bundleSplit, includeGwp, detail },
        countFilter: (params.get("count") as SkuState["countFilter"]) ?? state.countFilter,
        creatorLimit: Number.isFinite(limit) && limit > 0 ? limit : state.creatorLimit,
        preset,
        from: params.get("from") ?? range?.from ?? state.from,
        to: params.get("to") ?? range?.to ?? state.to,
        compare: (params.get("compare") as CompareBasis) ?? state.compare,
        trendGranularity: (params.get("trend") as TrendGranularity) ?? state.trendGranularity,
        level: (params.get("level") as SkuLevel) ?? state.level,
        attributeBase: (params.get("attr") as SkuAttributeBase) ?? state.attributeBase,
        scope: splitParam(params.get("scope")) ?? state.scope,
        selectedBarcodes: splitParam(params.get("sku")) ?? state.selectedBarcodes,
        quadrant: (params.get("quad") as SkuQuadrantPreset) ?? state.quadrant,
        excludeOutliers: params.get("noOutliers") === "1" ? true : state.excludeOutliers,
        search: params.get("q") ?? state.search,
        creatorManaged: managed === "true" ? true : managed === "false" ? false : state.creatorManaged,
        prevFrom: params.get("prevFrom") ?? state.prevFrom,
        prevTo: params.get("prevTo") ?? state.prevTo,
      }
    }),
}))

/** The bar offers both the SKU dimensions and the PID ones, matching the Tableau page. */
export const SKU_DETAIL_KEYS: DetailFilterKey[] = [
  "pillar",
  "pidCategory",
  "pidSubCategory",
  "pidFormat",
  "productCategory",
  "productSubCategory",
  "productFormat",
]

function splitParam(value: string | null): string[] | null {
  if (value === null) return null
  return value.split(",").map((v) => v.trim()).filter(Boolean)
}

function hydrateDetail(params: URLSearchParams, current: DetailFilters): DetailFilters {
  const detail: DetailFilters = { ...current }
  for (const key of SKU_DETAIL_KEYS) {
    const values = splitParam(params.get(key))
    if (values?.length) detail[key] = values
  }
  return detail
}

export function skuFiltersToParams(state: SkuState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.brand.length > 0) params.set("brand", state.brand.join(","))
  if (state.marketplace.length > 0) params.set("marketplace", state.marketplace.join(","))
  if (state.bundleType.length > 0) params.set("bundleType", state.bundleType.join(","))
  if (!state.bundleSplit) params.set("split", "0")
  if (state.includeGwp) params.set("gwp", "1")
  for (const key of SKU_DETAIL_KEYS) {
    const values = state.detail[key]
    if (values?.length) params.set(key, values.join(","))
  }
  params.set("preset", state.preset)
  params.set("from", state.from)
  params.set("to", state.to)
  params.set("compare", state.compare)
  params.set("trend", state.trendGranularity)
  params.set("level", state.level)
  if (state.attributeBase !== "product") params.set("attr", state.attributeBase)
  if (state.scope.length > 0) params.set("scope", state.scope.join(","))
  if (state.selectedBarcodes.length > 0) params.set("sku", state.selectedBarcodes.join(","))
  params.set("quad", state.quadrant)
  if (state.countFilter !== "all") params.set("count", state.countFilter)
  if (state.creatorLimit !== 20) params.set("crLimit", String(state.creatorLimit))
  if (state.excludeOutliers) params.set("noOutliers", "1")
  if (state.search) params.set("q", state.search)
  if (state.creatorManaged !== null) params.set("managed", String(state.creatorManaged))
  if (state.compare === "custom" && state.prevFrom && state.prevTo) {
    params.set("prevFrom", state.prevFrom)
    params.set("prevTo", state.prevTo)
  }
  return params
}
