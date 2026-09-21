import { create } from "zustand"
import { type DatePreset, computePresetRange } from "@/lib/date-range"
import type { PidLevel, QuadrantPreset } from "@/types/shopee-pid"
import type { DetailFilterKey, DetailFilters } from "@/types/overview"
import type { CompareBasis, TrendGranularity } from "@/store/overview-filters"

/** What the filter bar is editing; nothing refetches until it is applied. */
export interface PidFilterDraft {
  brand: string[]
  detail: DetailFilters
}

interface ShopeePidState {
  brand: string[]
  detail: DetailFilters
  draft: PidFilterDraft
  preset: DatePreset
  from: string
  to: string
  compare: CompareBasis
  trendGranularity: TrendGranularity
  level: PidLevel
  scope: string[]
  selectedPids: string[]
  /** Which count card is filtering the product table. */
  countFilter: "all" | "growing" | "decline"
  /** Products picked by dragging a rectangle on the quadrant; also narrows the product table. */
  quadrantSelection: string[]
  /** How many rows the top creators table shows. */
  creatorLimit: number
  quadrant: QuadrantPreset
  excludeOutliers: boolean
  search: string
  creatorPillar: string | null
  creatorManaged: boolean | null
  /** Explicit comparison window, used when compare is "custom". */
  prevFrom: string | null
  prevTo: string | null
  setDraftBrand: (brand: string[]) => void
  setDraftDetail: (key: DetailFilterKey, values: string[]) => void
  clearDraftDetail: () => void
  applyDraft: () => void
  discardDraft: () => void
  setPreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  setCompare: (compare: CompareBasis) => void
  setTrendGranularity: (granularity: TrendGranularity) => void
  setLevel: (level: PidLevel) => void
  setScope: (scope: string[]) => void
  toggleScope: (value: string) => void
  setSelectedPids: (pids: string[]) => void
  toggleSelectedPid: (pid: string) => void
  setCountFilter: (filter: "all" | "growing" | "decline") => void
  setQuadrantSelection: (pids: string[]) => void
  setCreatorLimit: (limit: number) => void
  setQuadrant: (quadrant: QuadrantPreset) => void
  setExcludeOutliers: (exclude: boolean) => void
  setSearch: (search: string) => void
  setCreatorPillar: (pillar: string | null) => void
  setCreatorManaged: (managed: boolean | null) => void
  setPrevRange: (from: string, to: string) => void
  hydrateFromParams: (params: URLSearchParams) => void
}

const defaultRange = computePresetRange("mtd")

export const useShopeePidFilters = create<ShopeePidState>((set) => ({
  brand: [],
  detail: {},
  draft: { brand: [], detail: {} },
  preset: "mtd",
  from: defaultRange.from,
  to: defaultRange.to,
  compare: "prev",
  trendGranularity: "day",
  level: "category",
  scope: [],
  selectedPids: [],
  countFilter: "all",
  quadrantSelection: [],
  creatorLimit: 20,
  quadrant: "gmv-growth",
  excludeOutliers: false,
  search: "",
  creatorPillar: null,
  creatorManaged: null,
  prevFrom: null,
  prevTo: null,

  setDraftBrand: (brand) => set((state) => ({ draft: { ...state.draft, brand } })),
  setDraftDetail: (key, values) =>
    set((state) => {
      const detail = { ...state.draft.detail }
      if (values.length > 0) detail[key] = values
      else delete detail[key]
      return { draft: { ...state.draft, detail } }
    }),
  clearDraftDetail: () => set((state) => ({ draft: { ...state.draft, detail: {} } })),
  applyDraft: () => set((state) => ({ brand: state.draft.brand, detail: state.draft.detail })),
  discardDraft: () => set((state) => ({ draft: { brand: state.brand, detail: state.detail } })),
  setPreset: (preset) =>
    set(preset === "custom" ? { preset } : { preset, ...computePresetRange(preset) }),
  setCustomRange: (from, to) => set({ preset: "custom", from, to }),
  setCompare: (compare) => set({ compare }),
  setTrendGranularity: (trendGranularity) => set({ trendGranularity }),
  // Changing level invalidates a scope picked under the previous level.
  setLevel: (level) => set({ level, scope: [] }),
  setScope: (scope) => set({ scope }),
  toggleScope: (value) =>
    set((state) => ({
      scope: state.scope.includes(value)
        ? state.scope.filter((v) => v !== value)
        : [...state.scope, value],
    })),
  setSelectedPids: (selectedPids) => set({ selectedPids }),
  toggleSelectedPid: (pid) =>
    set((state) => ({
      selectedPids: state.selectedPids.includes(pid)
        ? state.selectedPids.filter((p) => p !== pid)
        : [...state.selectedPids, pid],
    })),
  setQuadrantSelection: (quadrantSelection) => set({ quadrantSelection }),
  setCreatorLimit: (creatorLimit) => set({ creatorLimit }),
  setCountFilter: (countFilter) =>
    set((state) => ({ countFilter: state.countFilter === countFilter ? "all" : countFilter })),
  setQuadrant: (quadrant) => set({ quadrant }),
  setExcludeOutliers: (excludeOutliers) => set({ excludeOutliers }),
  setSearch: (search) => set({ search }),
  setCreatorPillar: (creatorPillar) => set({ creatorPillar }),
  setCreatorManaged: (creatorManaged) => set({ creatorManaged }),
  setPrevRange: (prevFrom, prevTo) => set({ compare: "custom", prevFrom, prevTo }),

  hydrateFromParams: (params) =>
    set((state) => {
      const preset = (params.get("preset") as DatePreset) || state.preset
      const range = preset === "custom" ? null : computePresetRange(preset)
      const managed = params.get("managed")
      const brand = splitParam(params.get("brand")) ?? state.brand
      const detail = hydrateDetail(params, state.detail)
      const limit = Number(params.get("crLimit"))

      return {
        brand,
        detail,
        draft: { brand, detail },
        countFilter: (params.get("count") as ShopeePidState["countFilter"]) ?? state.countFilter,
        creatorLimit: Number.isFinite(limit) && limit > 0 ? limit : state.creatorLimit,
        preset,
        from: params.get("from") ?? range?.from ?? state.from,
        to: params.get("to") ?? range?.to ?? state.to,
        compare: (params.get("compare") as CompareBasis) ?? state.compare,
        trendGranularity: (params.get("trend") as TrendGranularity) ?? state.trendGranularity,
        level: (params.get("level") as PidLevel) ?? state.level,
        scope: splitParam(params.get("scope")) ?? state.scope,
        selectedPids: params.get("pid")?.split(",").filter(Boolean) ?? state.selectedPids,
        quadrant: (params.get("quad") as QuadrantPreset) ?? state.quadrant,
        excludeOutliers: params.get("noOutliers") === "1" ? true : state.excludeOutliers,
        search: params.get("q") ?? state.search,
        creatorPillar: params.get("crPillar") ?? state.creatorPillar,
        creatorManaged: managed === "true" ? true : managed === "false" ? false : state.creatorManaged,
        prevFrom: params.get("prevFrom") ?? state.prevFrom,
        prevTo: params.get("prevTo") ?? state.prevTo,
      }
    }),
}))

/** The bar only offers the PID dimensions, so only those travel in the URL. */
const PID_DETAIL_KEYS: DetailFilterKey[] = ["pillar", "pidCategory", "pidSubCategory", "pidFormat"]

function splitParam(value: string | null): string[] | null {
  if (value === null) return null
  return value.split(",").map((v) => v.trim()).filter(Boolean)
}

function hydrateDetail(params: URLSearchParams, current: DetailFilters): DetailFilters {
  const detail: DetailFilters = { ...current }
  for (const key of PID_DETAIL_KEYS) {
    const values = splitParam(params.get(key))
    if (values?.length) detail[key] = values
  }
  return detail
}

export function pidFiltersToParams(state: ShopeePidState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.brand.length > 0) params.set("brand", state.brand.join(","))
  for (const key of PID_DETAIL_KEYS) {
    const values = state.detail[key]
    if (values?.length) params.set(key, values.join(","))
  }
  params.set("preset", state.preset)
  params.set("from", state.from)
  params.set("to", state.to)
  params.set("compare", state.compare)
  params.set("trend", state.trendGranularity)
  params.set("level", state.level)
  if (state.scope.length > 0) params.set("scope", state.scope.join(","))
  if (state.selectedPids.length > 0) params.set("pid", state.selectedPids.join(","))
  params.set("quad", state.quadrant)
  if (state.countFilter !== "all") params.set("count", state.countFilter)
  if (state.creatorLimit !== 20) params.set("crLimit", String(state.creatorLimit))
  if (state.excludeOutliers) params.set("noOutliers", "1")
  if (state.search) params.set("q", state.search)
  if (state.creatorPillar) params.set("crPillar", state.creatorPillar)
  if (state.creatorManaged !== null) params.set("managed", String(state.creatorManaged))
  if (state.compare === "custom" && state.prevFrom && state.prevTo) {
    params.set("prevFrom", state.prevFrom)
    params.set("prevTo", state.prevTo)
  }
  return params
}
