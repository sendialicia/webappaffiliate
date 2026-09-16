import { create } from "zustand"
import { type DatePreset, computePresetRange, currentMonth } from "@/lib/date-range"
import type {
  CompositionDimension,
  DetailFilterKey,
  DetailFilters,
  DriverField,
  DriverEntity,
} from "@/types/overview"

export type CompareBasis = "prev" | "ly" | "custom"
export type TrendGranularity = "day" | "week" | "month"

interface OverviewFiltersState {
  brand: string | null
  marketplace: string | null
  preset: DatePreset
  from: string
  to: string
  compare: CompareBasis
  month: string
  trendGranularity: TrendGranularity
  dimension: CompositionDimension
  selectedSlice: string | null
  driverEntity: DriverField
  driverDimension: DriverField
  spendEntity: DriverEntity
  prevFrom: string | null
  prevTo: string | null
  detail: DetailFilters
  setBrand: (brand: string | null) => void
  setMarketplace: (marketplace: string | null) => void
  setPreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  setCompare: (compare: CompareBasis) => void
  setMonth: (month: string) => void
  setTrendGranularity: (granularity: TrendGranularity) => void
  setDimension: (dimension: CompositionDimension) => void
  setSelectedSlice: (slice: string | null) => void
  setPrevRange: (from: string, to: string) => void
  setDetailFilter: (key: DetailFilterKey, value: string | null) => void
  clearDetailFilters: () => void
  setDriverEntity: (entity: DriverField) => void
  setDriverDimension: (dimension: DriverField) => void
  setSpendEntity: (entity: DriverEntity) => void
  hydrateFromParams: (params: URLSearchParams) => void
}

const defaultRange = computePresetRange("mtd")

export const useOverviewFilters = create<OverviewFiltersState>((set) => ({
  brand: null,
  marketplace: null,
  preset: "mtd",
  from: defaultRange.from,
  to: defaultRange.to,
  compare: "prev",
  month: currentMonth(),
  trendGranularity: "day",
  dimension: "pillar",
  selectedSlice: null,
  driverEntity: "brand",
  driverDimension: "pidFormat",
  spendEntity: "brand",
  prevFrom: null,
  prevTo: null,
  detail: {},

  setBrand: (brand) => set({ brand }),
  setMarketplace: (marketplace) => set({ marketplace }),
  setPreset: (preset) =>
    set(preset === "custom" ? { preset } : { preset, ...computePresetRange(preset) }),
  setCustomRange: (from, to) => set({ preset: "custom", from, to }),
  setCompare: (compare) => set({ compare }),
  setMonth: (month) => set({ month }),
  setTrendGranularity: (trendGranularity) => set({ trendGranularity }),
  // Switching dimension invalidates any slice selected under the old one.
  setDimension: (dimension) => set({ dimension, selectedSlice: null }),
  setSelectedSlice: (selectedSlice) => set({ selectedSlice }),
  setPrevRange: (prevFrom, prevTo) => set({ compare: "custom", prevFrom, prevTo }),
  setDetailFilter: (key, value) =>
    set((state) => {
      const detail = { ...state.detail }
      if (value) detail[key] = value
      else delete detail[key]
      return { detail }
    }),
  clearDetailFilters: () => set({ detail: {} }),
  setDriverEntity: (driverEntity) => set({ driverEntity }),
  setDriverDimension: (driverDimension) => set({ driverDimension }),
  setSpendEntity: (spendEntity) => set({ spendEntity }),

  hydrateFromParams: (params) =>
    set((state) => {
      const preset = (params.get("preset") as DatePreset) || state.preset
      const range = preset === "custom" ? null : computePresetRange(preset)
      return {
        brand: params.get("brand") ?? state.brand,
        marketplace: params.get("marketplace") ?? state.marketplace,
        preset,
        from: params.get("from") ?? range?.from ?? state.from,
        to: params.get("to") ?? range?.to ?? state.to,
        compare: (params.get("compare") as CompareBasis) ?? state.compare,
        month: params.get("month") ?? state.month,
        trendGranularity: (params.get("trend") as TrendGranularity) ?? state.trendGranularity,
        dimension: (params.get("dim") as CompositionDimension) ?? state.dimension,
        selectedSlice: params.get("slice") ?? state.selectedSlice,
        driverEntity: (params.get("drvEntity") as DriverField) ?? state.driverEntity,
        driverDimension: (params.get("drvDim") as DriverField) ?? state.driverDimension,
        spendEntity: (params.get("spendEntity") as DriverEntity) ?? state.spendEntity,
        prevFrom: params.get("prevFrom") ?? state.prevFrom,
        prevTo: params.get("prevTo") ?? state.prevTo,
        detail: hydrateDetail(params, state.detail),
      }
    }),
}))

export const DETAIL_FILTER_KEYS: DetailFilterKey[] = [
  "pillar",
  "subpillar",
  "pidCategory",
  "pidSubCategory",
  "pidFormat",
  "productCategory",
  "productSubCategory",
  "productFormat",
]

function hydrateDetail(params: URLSearchParams, current: DetailFilters): DetailFilters {
  const detail: DetailFilters = { ...current }
  for (const key of DETAIL_FILTER_KEYS) {
    const value = params.get(key)
    if (value) detail[key] = value
  }
  return detail
}

export function filtersToParams(state: OverviewFiltersState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.brand) params.set("brand", state.brand)
  if (state.marketplace) params.set("marketplace", state.marketplace)
  params.set("preset", state.preset)
  params.set("from", state.from)
  params.set("to", state.to)
  params.set("compare", state.compare)
  params.set("month", state.month)
  params.set("trend", state.trendGranularity)
  params.set("dim", state.dimension)
  if (state.selectedSlice) params.set("slice", state.selectedSlice)
  params.set("drvEntity", state.driverEntity)
  params.set("drvDim", state.driverDimension)
  params.set("spendEntity", state.spendEntity)
  if (state.compare === "custom") {
    if (state.prevFrom) params.set("prevFrom", state.prevFrom)
    if (state.prevTo) params.set("prevTo", state.prevTo)
  }
  for (const key of DETAIL_FILTER_KEYS) {
    const value = state.detail[key]
    if (value) params.set(key, value)
  }
  return params
}
