import { create } from "zustand"
import { type DatePreset, computePresetRange } from "@/lib/date-range"
import type { PidLevel, QuadrantPreset } from "@/types/shopee-pid"
import type { CompareBasis, TrendGranularity } from "@/store/overview-filters"

interface ShopeePidState {
  brand: string | null
  preset: DatePreset
  from: string
  to: string
  compare: CompareBasis
  trendGranularity: TrendGranularity
  level: PidLevel
  scope: string | null
  selectedPids: string[]
  /** Which count card is filtering the product table. */
  countFilter: "all" | "profit" | "decline"
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
  setBrand: (brand: string | null) => void
  setPreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  setCompare: (compare: CompareBasis) => void
  setTrendGranularity: (granularity: TrendGranularity) => void
  setLevel: (level: PidLevel) => void
  setScope: (scope: string | null) => void
  setSelectedPids: (pids: string[]) => void
  toggleSelectedPid: (pid: string) => void
  setCountFilter: (filter: "all" | "profit" | "decline") => void
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
  brand: null,
  preset: "mtd",
  from: defaultRange.from,
  to: defaultRange.to,
  compare: "prev",
  trendGranularity: "day",
  level: "category",
  scope: null,
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

  setBrand: (brand) => set({ brand }),
  setPreset: (preset) =>
    set(preset === "custom" ? { preset } : { preset, ...computePresetRange(preset) }),
  setCustomRange: (from, to) => set({ preset: "custom", from, to }),
  setCompare: (compare) => set({ compare }),
  setTrendGranularity: (trendGranularity) => set({ trendGranularity }),
  // Changing level invalidates a scope picked under the previous level.
  setLevel: (level) => set({ level, scope: null }),
  setScope: (scope) => set({ scope }),
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

      return {
        brand: params.get("brand") ?? state.brand,
        preset,
        from: params.get("from") ?? range?.from ?? state.from,
        to: params.get("to") ?? range?.to ?? state.to,
        compare: (params.get("compare") as CompareBasis) ?? state.compare,
        trendGranularity: (params.get("trend") as TrendGranularity) ?? state.trendGranularity,
        level: (params.get("level") as PidLevel) ?? state.level,
        scope: params.get("scope") ?? state.scope,
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

export function pidFiltersToParams(state: ShopeePidState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.brand) params.set("brand", state.brand)
  params.set("preset", state.preset)
  params.set("from", state.from)
  params.set("to", state.to)
  params.set("compare", state.compare)
  params.set("trend", state.trendGranularity)
  params.set("level", state.level)
  if (state.scope) params.set("scope", state.scope)
  if (state.selectedPids.length > 0) params.set("pid", state.selectedPids.join(","))
  params.set("quad", state.quadrant)
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
