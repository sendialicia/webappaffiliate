"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterBar } from "@/components/overview/filter-bar"
import { FindingsFeed } from "@/components/overview/findings-feed"
import { MonthlyPerformanceChart } from "@/components/charts/monthly-performance-chart"
import { AnnotationLane } from "@/components/charts/annotation-lane"
import { DailyPerformanceChart } from "@/components/charts/daily-performance-chart"
import { PaceGauge } from "@/components/charts/pace-gauge"
import { ProgressBars } from "@/components/charts/progress-bars"
import { DualKpiCard, KpiCard } from "@/components/charts/kpi-card"
import { AffSelfChart } from "@/components/charts/aff-self-chart"
import { WaterfallChart } from "@/components/charts/waterfall-chart"
import { CompositionTrendChart } from "@/components/charts/composition-trend-chart"
import { CompositionTable, DIMENSION_COLORS } from "@/components/overview/composition-table"
import { CompositionDetail } from "@/components/overview/composition-detail"
import { GmvDecomposition } from "@/components/overview/gmv-decomposition"
import type { DownloadItem } from "@/components/download-menu"
import {
  DRIVER_LABEL_WIDTH,
  DRIVER_MAX_HEIGHT,
  DriverChart,
  DriverLegend,
  driverChartHeight,
} from "@/components/charts/driver-chart"
import { GmvCommissionChart, ROI_THRESHOLD, RoiChart } from "@/components/charts/roi-chart"
import { AcquisitionChart } from "@/components/charts/acquisition-chart"
import { SpendTable } from "@/components/overview/spend-table"
import { ContentFunnel } from "@/components/overview/content-funnel"
import { apiFetch } from "@/lib/api"
import { useMediaQuery } from "@/lib/use-media-query"
import { DriverMatrix } from "@/components/overview/driver-matrix"
import { computeFindings } from "@/lib/findings"
import { formatIdr, formatMonthLabelFull, formatPercent, formatRp, formatRpFull } from "@/lib/format"
import { currentMonth } from "@/lib/date-range"
import { filtersToParams, useOverviewFilters } from "@/store/overview-filters"
import type {
  CompositionDimension,
  CompositionResult,
  DailyPerformancePoint,
  DriverField,
  DriverEntity,
  DriversResult,
  DriverMatrixResult,
  FilterOptionsResult,
  FunnelResult,
  MonthlyPerformanceResult,
  ProgressResult,
  SpendResult,
  SummaryResult,
} from "@/types/overview"

const SECTION_NAV = [
  { id: "ov-sec-1", label: "Performa tahun ini" },
  { id: "ov-sec-2", label: "Daily achievement" },
  { id: "ov-sec-3", label: "Progress bar bulanan" },
  { id: "ov-sec-4", label: "Summary" },
  { id: "ov-sec-5", label: "Komposisi GMV" },
  { id: "ov-sec-6", label: "Format per brand" },
  { id: "ov-sec-7", label: "Conversion funnel" },
  { id: "ov-sec-8", label: "Affiliate's health" },
  { id: "ov-sec-9", label: "Spend & akuisisi" },
]

/** Both sides of the driver chart pick from the same list; a side cannot pick what the other holds. */
/** Same list and order as the composition dropdown above, so both sections offer the same cuts. */
const DRIVER_FIELD_LABELS: Record<DriverField, string> = {
  pillar: "Pillar",
  subpillar: "Sub Pillar",
  brand: "Brand",
  marketplace: "Marketplace",
  pidCategory: "PID Category",
  pidSubCategory: "PID Sub Category",
  pidFormat: "PID Format",
  productCategory: "Product Category",
  productSubCategory: "Product Sub Category",
  productFormat: "Product Format",
}

const DRIVER_FIELDS = Object.keys(DRIVER_FIELD_LABELS) as DriverField[]

/** Insertion order drives the dropdown; the labels say PID where the column is PID-level. */
/** Insertion order drives the dropdown; labels say PID where the column is PID-level. */
const DIMENSION_LABELS: Record<CompositionDimension, string> = {
  pillar: "Pillar",
  subpillar: "Sub Pillar",
  brand: "Brand",
  marketplace: "Marketplace",
  category: "PID Category",
  pidSubCategory: "PID Sub Category",
  format: "PID Format",
  productCategory: "Product Category",
  productSubCategory: "Product Sub Category",
  productFormat: "Product Format",
}

const DIMENSION_OPTIONS = Object.keys(DIMENSION_LABELS) as CompositionDimension[]

/** Multi-value filters travel as one comma separated parameter. */
function csv(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

function OverviewPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)

  const filters = useOverviewFilters()
  // Matches Tailwind's lg breakpoint, where the driver panels sit side by side.
  const sideBySide = useMediaQuery("(min-width: 1024px)")
  const {
    brand,
    marketplace,
    from,
    to,
    compare,
    month,
    trendGranularity,
    dimension,
    selectedSlice,
    driverEntity,
    driverDimension,
    driverView,
    spendEntity,
    detail,
    prevFrom,
    prevTo,
    hydrateFromParams,
    setMonth,
    setSelectedSlice,
  } = filters

  const [monthly, setMonthly] = useState<MonthlyPerformanceResult | null>(null)
  const [daily, setDaily] = useState<DailyPerformancePoint[] | null>(null)
  const [progress, setProgress] = useState<ProgressResult | null>(null)
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [composition, setComposition] = useState<CompositionResult | null>(null)
  const [drivers, setDrivers] = useState<DriversResult | null>(null)
  const [matrix, setMatrix] = useState<DriverMatrixResult | null>(null)
  const [spend, setSpend] = useState<SpendResult | null>(null)
  const [funnel, setFunnel] = useState<FunnelResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Whether the reader has scrolled down to Summary, where Tren and the dimension filters start
  // to apply; above it they would only look like they control the performance blocks.
  const [summaryReached, setSummaryReached] = useState(false)

  const detailKey = JSON.stringify(detail)
  const detailParams = Object.fromEntries(
    Object.entries(detail)
      .filter(([, v]) => v && v.length > 0)
      .map(([k, v]) => [k, (v as string[]).join(",")]),
  ) as Record<string, string>
  const prevParams =
    compare === "custom" && prevFrom && prevTo ? { prevFrom, prevTo } : ({} as Record<string, string>)

  useEffect(() => {
    const el = document.getElementById("ov-sec-4")
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setSummaryReached(entry.isIntersecting || entry.boundingClientRect.top < 0)
      },
      // "Reached" once Summary's top is in the upper half of the viewport, or above it.
      { rootMargin: "0px 0px -50% 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Hydrate filter state from the URL once on mount, so shared links load the same view.
  useEffect(() => {
    hydrateFromParams(searchParams)
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the URL in sync with filter state so the current view is always shareable.
  useEffect(() => {
    if (!hydrated.current) return
    const qs = filtersToParams(filters).toString()
    router.replace(`${pathname}?${qs}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand,
    marketplace,
    from,
    to,
    compare,
    month,
    trendGranularity,
    dimension,
    selectedSlice,
    driverEntity,
    driverDimension,
    driverView,
    spendEntity,
    detailKey,
    prevFrom,
    prevTo,
  ])


  useEffect(() => {
    let stale = false
    apiFetch<FilterOptionsResult>(
      `/api/overview/filter-options${buildQuery({ from, to, brand: csv(brand), marketplace: csv(marketplace) })}`,
    )
      .then((data) => {
        if (!stale) setFilterOptions(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load filter options")
      })
    return () => {
      stale = true
    }
  }, [from, to, brand, marketplace])

  useEffect(() => {
    let stale = false
    const year = new Date().getFullYear()
    apiFetch<MonthlyPerformanceResult>(
      `/api/overview/monthly-performance${buildQuery({ year: String(year), brand: csv(brand), marketplace: csv(marketplace) })}`,
    )
      .then((data) => {
        if (!stale) setMonthly(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load monthly performance")
      })
    return () => {
      stale = true
    }
  }, [brand, marketplace])

  useEffect(() => {
    let stale = false
    apiFetch<DailyPerformancePoint[]>(
      `/api/overview/daily-performance${buildQuery({ month, brand: csv(brand), marketplace: csv(marketplace) })}`,
    )
      .then((data) => {
        if (!stale) setDaily(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load daily performance")
      })
    return () => {
      stale = true
    }
  }, [month, brand, marketplace])

  useEffect(() => {
    let stale = false
    apiFetch<ProgressResult>(
      `/api/overview/progress${buildQuery({ month, brand: csv(brand), marketplace: csv(marketplace) })}`,
    )
      .then((data) => {
        if (!stale) setProgress(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load progress")
      })
    return () => {
      stale = true
    }
  }, [month, brand, marketplace])

  useEffect(() => {
    let stale = false
    apiFetch<SummaryResult>(
      `/api/overview/summary${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setSummary(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load summary")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    let stale = false
    apiFetch<CompositionResult>(
      `/api/overview/composition${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        dimension,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setComposition(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load composition")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, dimension, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    let stale = false
    apiFetch<DriversResult>(
      `/api/overview/drivers${buildQuery({
        from,
        to,
        compare,
        entity: driverEntity,
        dimension: driverDimension,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setDrivers(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load drivers")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, driverEntity, driverDimension, brand, marketplace, detailKey, prevFrom, prevTo])

  // The matrix costs four queries, so it only loads while its view is open.
  useEffect(() => {
    if (driverView !== "matrix") return
    let stale = false
    apiFetch<DriverMatrixResult>(
      `/api/overview/driver-matrix${buildQuery({
        from,
        to,
        compare,
        entity: driverEntity,
        dimension: driverDimension,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setMatrix(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load GMV matrix")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverView, from, to, compare, driverEntity, driverDimension, brand, marketplace, detailKey, prevFrom, prevTo])

  /**
   * Clicking a matrix cell narrows the whole page to that entity and/or dimension value. Brand and
   * marketplace are top-level filters; every other driver field shares its key with a detail filter.
   */
  const drillTo = (entityValue: string | null, nameValue: string | null) => {
    const apply = (field: DriverField, value: string) => {
      if (field === "brand") filters.setDraftBrand([value])
      else if (field === "marketplace") filters.setDraftMarketplace([value])
      else filters.setDraftDetail(field, [value])
    }
    if (entityValue) apply(driverEntity, entityValue)
    if (nameValue) apply(driverDimension, nameValue)
    filters.applyDraft()
  }

  useEffect(() => {
    let stale = false
    apiFetch<SpendResult>(
      `/api/overview/spend${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        entity: spendEntity,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setSpend(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load spend")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, spendEntity, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    let stale = false
    apiFetch<FunnelResult>(
      `/api/overview/funnel${buildQuery({
        from,
        to,
        compare,
        brand: csv(brand),
        marketplace: csv(marketplace),
        ...prevParams,
      })}`,
    )
      .then((data) => {
        if (!stale) setFunnel(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Failed to load funnel")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, brand, marketplace, prevFrom, prevTo])

  const onMonthClick = useCallback((clickedMonth: string) => setMonth(clickedMonth), [setMonth])

  const compareLabel =
    compare === "ly" ? "vs LY" : compare === "custom" ? "vs periode pembanding" : "vs prev period"
  const findings = computeFindings(monthly?.pace, summary?.kpis, progress, compareLabel, summary?.trend)


  // Every entry is built from the same state the section renders, so a download always
  // matches what the reader is looking at, including the filters in force.
  const downloads: DownloadItem[] = [
    {
      id: "performa-tahunan",
      label: "Performa tahun ini",
      rows: () => (monthly?.months ?? []).map((m) => ({ ...m })),
    },
    {
      id: "daily-achievement",
      label: `Daily achievement · ${month}`,
      rows: () => (daily ?? []).map((d) => ({ ...d })),
    },
    {
      id: "progress-bulanan",
      label: "Progress bar bulanan",
      rows: () => [
        ...(progress?.marketplace ?? []).map((r) => ({ grup: "Marketplace", ...r })),
        ...(progress?.brand ?? []).map((r) => ({ grup: "Brand", ...r })),
      ],
    },
    {
      id: "summary-kpi",
      label: "Summary · nilai KPI",
      rows: () =>
        summary
          ? Object.entries(summary.kpis).map(([metric, v]) => ({
              metric,
              value: v.value,
              delta: v.delta,
              deltaPct: v.deltaPct,
            }))
          : [],
    },
    {
      id: "summary-tren",
      label: "Summary · tren harian",
      rows: () => (summary?.trend ?? []).map((t) => ({ ...t })),
    },
    {
      id: "komposisi-gmv",
      label: `Komposisi GMV per ${DIMENSION_LABELS[dimension]}`,
      rows: () => (composition?.rows ?? []).map((r) => ({ ...r })),
    },
    {
      id: "komposisi-tren",
      label: "Komposisi GMV · tren",
      rows: () => (composition?.trend ?? []).map((t) => ({ ...t })),
    },
    {
      id: "gmv-matrix",
      label: `GMV Matrix · ${DRIVER_FIELD_LABELS[driverDimension]} per ${DRIVER_FIELD_LABELS[driverEntity]}`,
      rows: () => {
        if (!matrix) return []
        return matrix.entities.flatMap((entity) =>
          matrix.names.map((name) => {
            const c = matrix.cells[entity]?.[name]
            return {
              [DRIVER_FIELD_LABELS[matrix.entity]]: entity,
              [DRIVER_FIELD_LABELS[matrix.dimension]]: name,
              gmv: c?.gmv ?? 0,
              gmvPrev: c?.gmvPrev ?? 0,
              creators: c?.creators ?? 0,
              creatorsPrev: c?.creatorsPrev ?? 0,
            }
          }),
        )
      },
    },
    {
      id: "driver",
      label: `Driver · ${DRIVER_FIELD_LABELS[driverDimension]} per ${DRIVER_FIELD_LABELS[driverEntity]}`,
      rows: () => {
        if (!drivers) return []
        const growthByEntity = new Map(drivers.entityGrowth.map((e) => [e.entity, e.growth]))
        return drivers.composition.flatMap((compRow) => {
          const entity = String(compRow.entity)
          const growRow = drivers.growth.find((g) => g.entity === entity)
          const diffRow = drivers.difference.find((d) => d.entity === entity)
          return drivers.names.map((name) => ({
            [DRIVER_FIELD_LABELS[drivers.entity]]: entity,
            [DRIVER_FIELD_LABELS[drivers.dimension]]: name,
            gmv: Number(compRow[name] ?? 0),
            growthPct: Number(growRow?.[name] ?? 0),
            gmvDifference: Number(diffRow?.[name] ?? 0),
            entityGrowthPct: growthByEntity.get(entity) ?? null,
          }))
        })
      },
    },
    {
      id: "funnel-stage",
      label: "Conversion funnel · tahapan",
      rows: () =>
        (funnel?.marketplaces ?? []).flatMap((m) =>
          m.stages.map((s) => ({
            marketplace: m.name,
            stage: s.label,
            value: s.value,
            prev: s.prev,
            deltaPct: s.deltaPct,
          })),
        ),
    },
    {
      id: "funnel-pillar",
      label: "Conversion funnel · per pillar",
      rows: () =>
        (funnel?.marketplaces ?? []).flatMap((m) =>
          m.pillars.map((p) => ({ marketplace: m.name, ...p })),
        ),
    },
    {
      id: "spend",
      label: `Spend & ROI per ${spendEntity === "brand" ? "Brand" : "Marketplace"}`,
      rows: () => (spend?.rows ?? []).map((r) => ({ ...r })),
    },
    {
      id: "akuisisi-creator",
      label: "Akuisisi creator",
      rows: () => (spend?.acquisition ?? []).map((a) => ({ ...a })),
    },
  ]

  const selectedRow = composition?.rows.find((r) => r.name === selectedSlice) ?? null
  const selectedIndex = composition?.rows.findIndex((r) => r.name === selectedSlice) ?? -1
  const selectedColor =
    selectedIndex >= 0 ? DIMENSION_COLORS[selectedIndex % DIMENSION_COLORS.length] : "var(--ov-gold)"

  return (
    <DashboardShell
      title="Performance Overview"
      subtitle="Melihat performa affiliate berdasarkan berbagai dimensi dan periode."
      sectionNav={SECTION_NAV}
    >
      <FilterBar
        brandOptions={filterOptions?.brands ?? progress?.brand.map((r) => r.name) ?? []}
        marketplaceOptions={filterOptions?.marketplaces ?? progress?.marketplace.map((r) => r.name) ?? []}
        dimensionOptions={filterOptions?.dimensions ?? []}
        downloads={downloads}
        // Still shown up top while a dimension filter is active, so it is never applied unseen.
        showSectionControls={
          summaryReached || Object.entries(detail).some(([key, values]) => key !== "pillar" && (values?.length ?? 0) > 0)
        }
      />

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-4 py-3 text-sm text-[var(--ov-red-ink)] md:mx-8">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
        <FindingsFeed findings={findings} />

        {/* Section 1: annual performance + on-track gauge */}
        <div id="ov-sec-1" className="grid scroll-mt-24 grid-cols-1 items-stretch gap-4.5 lg:grid-cols-2">
          <div
            className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="text-lg font-semibold font-(family-name:--font-archivo)">
              How have we been performing this year?
            </div>
            <div className="mt-2.5 flex gap-4.5 text-sm text-[var(--ov-mut2)]">
              <span className="flex items-center gap-1.5">
                <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-gold)" }} />
                Actual GMV
              </span>
              <span className="flex items-center gap-1.5">
                <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-blue)" }} />
                LY GMV
              </span>
              <span className="flex items-center gap-1.5">
                <i className="block h-2.5 w-2.5 rounded-full" style={{ background: "var(--ov-red)" }} />
                Target
              </span>
            </div>
            {monthly ? (
              <MonthlyPerformanceChart months={monthly.months} onMonthClick={onMonthClick} />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-[var(--ov-faint)]">
                Loading…
              </div>
            )}
            <div className="mt-1 text-xs text-[var(--ov-faint)]">Klik bulan pada grafik untuk melihat rincian harian di bawah.</div>
          </div>

          <div
            className="flex flex-col rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="flex items-start justify-between gap-4.5">
              <div>
                <div className="text-lg font-semibold font-(family-name:--font-archivo)">Are we on track this month?</div>
                {monthly && (
                  <span className="mt-1.5 inline-block rounded-full border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-2.5 py-1 text-xs font-semibold text-[var(--ov-soft)]">
                    Bulan berjalan &middot; {monthly.pace.monthLabel}
                  </span>
                )}
              </div>
              {monthly && (
                <div className="text-right">
                  <div className="text-sm text-[var(--ov-mut)]">Remaining</div>
                  <div className="text-lg font-bold font-(family-name:--font-archivo)">
                    {formatRp(Math.max(monthly.pace.remaining, 0))}
                  </div>
                  <div className="text-sm text-[var(--ov-mut)]">in {monthly.pace.daysLeft} days left</div>
                </div>
              )}
            </div>
            {monthly ? (
              <>
                <PaceGauge pace={monthly.pace} />
                <div className="mt-2 flex justify-between font-mono text-xs text-[var(--ov-soft)]">
                  <span>
                    {formatRp(monthly.pace.actual)} of {formatRp(monthly.pace.target)}
                  </span>
                  <span className="text-[var(--ov-faint)]">expected to date {formatRp(monthly.pace.expected)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3.5 border-t border-[var(--ov-line)] pt-4">
                  <div>
                    <div className="text-xs text-[var(--ov-mut)]">Waktu berjalan</div>
                    <div className="text-base font-bold font-(family-name:--font-archivo)">
                      {formatPercent(monthly.pace.expectedPct)}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--ov-faint)]">
                      bulan ini sudah lewat sejauh ini
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--ov-mut)]">Proyeksi akhir bulan</div>
                    <div className="text-base font-bold font-(family-name:--font-archivo)">
                      {formatRp(monthly.pace.projection)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )}
          </div>
        </div>

        {/* Section 2: daily drill-down */}
        <div
          id="ov-sec-2"
          className="scroll-mt-24 rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-lg font-semibold font-(family-name:--font-archivo)">How is our daily achievement?</div>
            <span className="text-sm text-[var(--ov-mut)]">Rincian harian untuk</span>
            <span className="flex items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
              {formatMonthLabelFull(`${month}-01`)}
              <button type="button" onClick={() => setMonth(currentMonth())} className="leading-none">
                &times;
              </button>
            </span>
          </div>
          {daily ? (
            <>
              <DailyPerformanceChart days={daily} />
              {/* Only this chart carries annotations — the day grain is what people annotate. */}
              <AnnotationLane
                days={daily.map((d) => d.date)}
                brands={brand}
                marketplaces={marketplace}
              />
            </>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* Section 3: monthly progress */}
        <div id="ov-sec-3" className="scroll-mt-24">
          <div className="mb-3 text-center text-xl font-bold font-(family-name:--font-archivo)">Progress Bar (Monthly)</div>
          <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2">
            {progress ? (
              <>
                <ProgressBars title="Marketplace" rows={progress.marketplace} />
                <ProgressBars title="Brand" rows={progress.brand} />
              </>
            ) : (
              <div className="col-span-2 flex h-[160px] items-center justify-center text-sm text-[var(--ov-faint)]">
                Loading…
              </div>
            )}
          </div>
        </div>

        {/* Section 4: summary KPIs */}
        <div id="ov-sec-4" className="scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="text-xl font-bold font-(family-name:--font-archivo)">Summary</div>
            <div className="h-px flex-1 bg-[var(--ov-line)]" />
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold tracking-wider text-[var(--ov-faint)] uppercase">Tren date</span>
              <Select value={trendGranularity} onValueChange={(v) => v && filters.setTrendGranularity(v)}>
                <SelectTrigger className="h-8 w-28 bg-[var(--input)] text-xs">
                  <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {summary ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:row-span-2">
                  <KpiCard
                    label="GMV Affiliate"
                    value={formatRp(summary.kpis.gmv.value)}
                    deltaPct={summary.kpis.gmv.deltaPct}
                    compareLabel={compareLabel}
                    sparkline={summary.trend}
                    sparklineKey="gmv"
                    color="var(--ov-blue)"
                    size="lg"
                    note={`${summary.kpis.gmv.delta >= 0 ? "+" : "−"}${formatRpFull(
                      Math.abs(summary.kpis.gmv.delta),
                    )} dari ${formatRpFull(summary.kpis.gmv.value - summary.kpis.gmv.delta)}`}
                    deltaHover={
                      <GmvDecomposition
                        gmv={summary.kpis.gmv}
                        creators={summary.kpis.creators}
                        gmvPerCreator={summary.kpis.gmvPerCreator}
                        compareLabel={compareLabel}
                      />
                    }
                  />
                </div>
                <KpiCard
                  label="Creators Count"
                  value={formatIdr(summary.kpis.creators.value)}
                  deltaPct={summary.kpis.creators.deltaPct}
                  compareLabel={compareLabel}
                  sparkline={summary.trend}
                  sparklineKey="creators"
                  color="var(--chart-5)"
                />
                <DualKpiCard
                  compareLabel={compareLabel}
                  sparkline={summary.trend}
                  metrics={[
                    {
                      label: "ASP",
                      value: formatRpFull(summary.kpis.asp.value),
                      deltaPct: summary.kpis.asp.deltaPct,
                      trendKey: "asp",
                      color: "var(--ov-gold-deep)",
                    },
                    {
                      label: "AOV",
                      value: formatRpFull(summary.kpis.aov.value),
                      deltaPct: summary.kpis.aov.deltaPct,
                      trendKey: "aov",
                      color: "var(--ov-blue)",
                    },
                  ]}
                />
                <KpiCard
                  label="GMV per Creator"
                  value={formatRpFull(summary.kpis.gmvPerCreator.value)}
                  deltaPct={summary.kpis.gmvPerCreator.deltaPct}
                  compareLabel={compareLabel}
                  sparkline={summary.trend}
                  sparklineKey="gmvPerCreator"
                  color="var(--ov-green)"
                />
                <KpiCard
                  label="Commission"
                  value={formatRp(summary.kpis.commission.value)}
                  deltaPct={summary.kpis.commission.deltaPct}
                  compareLabel={compareLabel}
                  positiveIsGood={false}
                  sparkline={summary.trend}
                  sparklineKey="commission"
                  color="var(--ov-gold)"
                />
                <div className="sm:col-span-2 lg:col-span-2">
                  <div
                    className="flex h-full flex-col rounded-xl border border-[var(--ov-line)] p-4.5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
                    style={{ background: "var(--ov-card-gradient)" }}
                  >
                    <div className="text-base font-semibold font-(family-name:--font-archivo)">
                      <span style={{ color: "var(--ov-gold-ink)" }}>Affiliate</span> vs Self Operated
                    </div>
                    <div className="mt-1.5 mb-1 text-sm text-[var(--ov-mut2)]">
                      Kontribusi affiliate pada periode ini{" "}
                      <span className="font-bold" style={{ color: "var(--ov-gold-ink)" }}>
                        {(summary.kpis.affiliateShare.value * 100).toFixed(1)}%
                      </span>
                    </div>
                    <AffSelfChart trend={summary.trend} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[160px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* Section 5: GMV composition */}
        <div
          id="ov-sec-5"
          className="scroll-mt-24 rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              How does the GMV composition vary by
            </span>
            <Select
              value={dimension}
              onValueChange={(v) => v && filters.setDimension(v as CompositionDimension)}
            >
              <SelectTrigger className="h-8 w-40 bg-[var(--input)] text-sm">
                <SelectValue>{(v: string) => DIMENSION_LABELS[v as CompositionDimension] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIMENSION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">?</span>
          </div>

          {composition ? (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <div className="text-[12.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                    Kontribusi tiap {DIMENSION_LABELS[dimension].toLowerCase()} pada perubahan GMV
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--ov-faint)]">
                    Dari {formatIdr(composition.totals.previous)} periode lalu ke{" "}
                    {formatIdr(composition.totals.current)} periode ini
                  </div>
                  <WaterfallChart result={composition} />
                </div>
                <div>
                  <CompositionTable
                    rows={composition.rows}
                    selected={selectedSlice}
                    onSelectAction={setSelectedSlice}
                  />
                  <div className="mt-2 text-xs text-[var(--ov-faint)]">
                    Klik baris untuk membuka detail dan menyorotnya pada grafik di bawah.
                    {composition.hidden.rows > 0 && (
                      <>
                        {" "}
                        Menampilkan {composition.rows.length} teratas; {composition.hidden.rows} nilai lain
                        senilai {formatIdr(composition.hidden.gmv)} tidak ditampilkan, jadi batangnya tidak
                        menjumlah ke total.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedRow && (
                <CompositionDetail
                  row={selectedRow}
                  result={composition}
                  color={selectedColor}
                  onCloseAction={() => setSelectedSlice(null)}
                />
              )}

              <div className="mt-5">
                <div className="mb-2 text-[12.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                  Over the time in current period
                </div>
                <CompositionTrendChart
                  trend={composition.trend}
                  // Matches the backend: top 12 series, the rest folded into "Lainnya".
                  names={[
                    ...composition.rows.slice(0, 12).map((r) => r.name),
                    ...(composition.rows.length > 12 ? ["Lainnya"] : []),
                  ]}
                  highlighted={selectedSlice}
                />
              </div>
            </>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* Section 6: growth/loss drivers */}
        <div
          id="ov-sec-6"
          className="scroll-mt-24 rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-red)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">Identify which</span>
            <Select
              value={driverDimension}
              onValueChange={(v) => v && filters.setDriverDimension(v as DriverField)}
            >
              <SelectTrigger className="h-8 w-44 bg-[var(--input)] text-sm">
                <SelectValue>{(v: string) => DRIVER_FIELD_LABELS[v as DriverField] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DRIVER_FIELDS.filter((f) => f !== driverEntity).map((f) => (
                  <SelectItem key={f} value={f}>
                    {DRIVER_FIELD_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              are driving growth or causing losses per
            </span>
            <Select value={driverEntity} onValueChange={(v) => v && filters.setDriverEntity(v as DriverField)}>
              <SelectTrigger className="h-8 w-44 bg-[var(--input)] text-sm">
                <SelectValue>{(v: string) => DRIVER_FIELD_LABELS[v as DriverField] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DRIVER_FIELDS.filter((f) => f !== driverDimension).map((f) => (
                  <SelectItem key={f} value={f}>
                    {DRIVER_FIELD_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-1 rounded-full border border-[var(--ov-line)] bg-[var(--ov-fill1)] p-0.5">
              {(
                [
                  ["chart", "Chart"],
                  ["matrix", "GMV Matrix"],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => filters.setDriverView(view)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: driverView === view ? "var(--accent)" : "transparent",
                    color: driverView === view ? "var(--accent-foreground)" : "var(--ov-mut)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {driverView === "matrix" ? (
            matrix && matrix.entity === driverEntity && matrix.dimension === driverDimension ? (
              <DriverMatrix
                result={matrix}
                entityLabel={DRIVER_FIELD_LABELS[driverEntity]}
                dimensionLabel={DRIVER_FIELD_LABELS[driverDimension]}
                compareLabel={compareLabel}
                onDrillAction={drillTo}
              />
            ) : (
              <div className="flex h-[330px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )
          ) : drivers ? (
            (() => {
              // The row count swings from 2 (marketplace) to 64 (PID format), so the block is
              // sized from the data and only scrolls once it would run past a screenful. The
              // three charts share one scroll container so their rows stay aligned.
              const chartHeight = driverChartHeight(drivers.composition.length)
              // Legend column is sized from its longest label so header and chart rows line up.
              const legendWidth = 34 + 7 * Math.max(0, ...drivers.names.map((n) => n.length))
              const scrolls = chartHeight > DRIVER_MAX_HEIGHT
              // Side by side, only the first panel carries the entity names; it gets their width
              // on top of an equal share (flex-basis) so the three plotting areas stay the same
              // size. Stacked on a narrow screen, every panel needs its own names again.
              const cols = "flex flex-col gap-3.5 lg:flex-row"
              const firstCol = { flex: `1 1 ${sideBySide ? DRIVER_LABEL_WIDTH : 0}px`, minWidth: 0 }
              const restCol = { flex: "1 1 0px", minWidth: 0 }
              const head =
                "rounded-md border border-[var(--accent)] bg-[var(--accent)] p-1.5 text-center text-[12.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase"

              return (
            <>
              {/* Headers sit outside the scroller so they stay put while the rows move. */}
              <div className={`${cols} mb-2`}>
                <div className={head} style={firstCol}>Composition</div>
                <div className={`${head} hidden lg:block`} style={restCol}>Growth GMV</div>
                <div className={`${head} hidden lg:block`} style={restCol}>GMV Difference</div>
                <div className="hidden lg:block" style={{ width: legendWidth }} />
              </div>
              <div
                className={scrolls ? "overflow-y-auto pr-1" : ""}
                style={scrolls ? { maxHeight: DRIVER_MAX_HEIGHT } : undefined}
              >
                <div className={cols}>
                  <div style={firstCol}>
                    <DriverChart rows={drivers.composition} names={drivers.names} unit="share" height={chartHeight} />
                  </div>
                  <div style={restCol}>
                    {!sideBySide && <div className={`${head} mb-2`}>Growth GMV</div>}
                    <DriverChart
                      rows={drivers.growth}
                      names={drivers.names}
                      unit="pp"
                      height={chartHeight}
                      showLabels={!sideBySide}
                    />
                  </div>
                  <div style={restCol}>
                    {!sideBySide && <div className={`${head} mb-2`}>GMV Difference</div>}
                    <DriverChart
                      rows={drivers.difference}
                      names={drivers.names}
                      height={chartHeight}
                      showLabels={!sideBySide}
                    />
                  </div>
                  <div className="flex-none" style={sideBySide ? { width: legendWidth } : undefined}>
                    <DriverLegend names={drivers.names} />
                  </div>
                </div>
              </div>
              {scrolls && (
                <div className="mt-2 text-[12.5px] text-[var(--ov-faint)]">
                  {drivers.composition.length} baris — gulir di dalam blok ini; ketiga panel bergerak bersama
                  supaya barisnya tetap sejajar.
                </div>
              )}
            </>
              )
            })()
          ) : (
            <div className="flex h-[330px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* Section 7: content conversion funnel */}
        <div id="ov-sec-7" className="scroll-mt-24 rounded-xl border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/5 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/15 text-sm font-bold text-[var(--ov-red-ink)]">
              !
            </span>
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">Content Conversion Funnel</span>
            <span className="text-[13px] text-[var(--ov-mut2)]">
              Funnel &amp; pillar stats dari summary order · new content dan total creators dari content
              performance.
            </span>
          </div>
          {funnel ? (
            <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
              {funnel.marketplaces.map((m) => (
                <ContentFunnel key={m.name} marketplace={m} periodTo={to} />
              ))}
            </div>
          ) : (
            <div className="flex h-[320px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* Section 8: affiliate health */}
        <div id="ov-sec-8" className="grid scroll-mt-24 grid-cols-1 gap-4.5 xl:grid-cols-2">
          <div>
            <div className="mb-3.5 text-xl font-bold font-(family-name:--font-archivo)">Affiliate&rsquo;s Health</div>
            {summary ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <KpiCard
                  label="ROI (GMV ÷ Commission)"
                  value={`${summary.kpis.roi.value.toFixed(1)}x`}
                  deltaPct={summary.kpis.roi.deltaPct}
                  compareLabel={compareLabel}
                  sparkline={summary.trend}
                  sparklineKey="roi"
                />
                <KpiCard
                  label="Commission Rate"
                  value={formatPercent(summary.kpis.commissionRate.value, 2)}
                  deltaPct={summary.kpis.commissionRate.deltaPct}
                  compareLabel={compareLabel}
                  positiveIsGood={false}
                  sparkline={summary.trend}
                  sparklineKey="commissionRate"
                />
                <KpiCard
                  label="Refund Rate"
                  value={formatPercent(summary.kpis.refundRate.value, 2)}
                  deltaPct={summary.kpis.refundRate.deltaPct}
                  compareLabel={compareLabel}
                  positiveIsGood={false}
                  sparkline={summary.trend}
                  sparklineKey="refundRate"
                />
                <KpiCard
                  label="Items Sold"
                  value={formatIdr(summary.kpis.itemsSold.value)}
                  deltaPct={summary.kpis.itemsSold.deltaPct}
                  compareLabel={compareLabel}
                  sparkline={summary.trend}
                  sparklineKey="itemsSold"
                />
              </div>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )}
          </div>

          <div
            className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 text-base font-semibold font-(family-name:--font-archivo)">
                <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
                Is GMV growing faster than what we pay?
              </div>
              <div className="flex flex-none flex-col gap-1 text-xs font-semibold text-[var(--ov-soft)]">
                <span className="flex items-center gap-1.5">
                  <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-blue)" }} />
                  Commission
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-gold)" }} />
                  GMV
                </span>
              </div>
            </div>
            {summary ? (
              <>
                <GmvCommissionChart trend={summary.trend} />
                <div className="mt-1 text-[12px] text-[var(--ov-faint)]">
                  Diindeks 100 pada awal periode — garis yang naik lebih curam tumbuh lebih cepat. Nilai rupiah
                  aslinya ada di tooltip.
                </div>
              </>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-4 border-t border-[var(--ov-line)] pt-3.5">
              <div className="flex items-center gap-2.5 text-base font-semibold font-(family-name:--font-archivo)">
                <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
                Is our efficiency growing?
              </div>
              <div className="flex flex-none items-center gap-1.5 text-xs font-semibold text-[var(--ov-soft)]">
                <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-green)" }} />
                ROI
              </div>
            </div>
            {summary ? <RoiChart trend={summary.trend} /> : null}

            {summary && (
              <div className="flex flex-wrap items-center gap-3.5 border-t border-[var(--ov-line)] pt-2.5 text-xs text-[var(--ov-faint)]">
                <span className="flex items-center gap-1.5">
                  <i className="block h-0 w-3.5 flex-none border-t border-dashed border-[var(--accent-foreground)]" />
                  Ambang ROI {ROI_THRESHOLD.toFixed(1)}x
                </span>
                <span>
                  {summary.trend.filter((t) => t.roi !== null && t.roi < ROI_THRESHOLD).length} dari{" "}
                  {summary.trend.filter((t) => t.roi !== null).length} periode di bawah ambang
                  {summary.trend.some((t) => t.roi === null) &&
                    ` · ${summary.trend.filter((t) => t.roi === null).length} periode belum ada data komisi`}
                </span>
                <span className="ml-auto font-semibold text-[var(--ov-soft)]">
                  Rata-rata periode {summary.kpis.roi.value.toFixed(1)}x
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 9: spend health + creator acquisition */}
        <div id="ov-sec-9" className="grid scroll-mt-24 grid-cols-1 gap-4.5 xl:grid-cols-2">
          <div
            className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
              <span className="text-base font-semibold font-(family-name:--font-archivo)">
                How healthy is our affiliate spend?
              </span>
              <Select value={spendEntity} onValueChange={(v) => v && filters.setSpendEntity(v as DriverEntity)}>
                <SelectTrigger className="h-7 w-32 bg-[var(--input)] text-xs">
                  <SelectValue>{(v: string) => (v === "brand" ? "Brand" : "Marketplace")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="marketplace">Marketplace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {spend ? (
              <SpendTable rows={spend.rows} />
            ) : (
              <div className="flex h-[240px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )}
          </div>

          <div
            className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="mb-2 flex items-center gap-2.5">
              <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
              <span className="text-base font-semibold font-(family-name:--font-archivo)">
                GMV Growth vs Creator Acquisition
              </span>
            </div>
            <div className="mb-2 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
              Apakah pertumbuhan GMV didorong <span className="font-semibold text-[var(--ov-soft)]">kuantitas</span>{" "}
              (creator bertambah) atau <span className="font-semibold text-[var(--ov-soft)]">kualitas</span> (GMV per
              creator naik)? Warna batang menunjukkan tuas yang dominan di tiap bucket.
            </div>
            {spend ? (
              <AcquisitionChart data={spend.acquisition} />
            ) : (
              <div className="flex h-[332px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )}
          </div>
        </div>

        <div className="text-xs leading-relaxed text-[var(--ov-faint)]">
          Catatan data: baris dengan <span className="font-mono">AFFILIATE_USERNAME = &ldquo;Agency&rdquo;</span>{" "}
          (TikTok) adalah agregat penjualan agency, bukan creator individual. GMV-nya tetap dihitung, tapi ia terhitung
          sebagai 1 creator — sehingga metrik Creators Count dan GMV per Creator sedikit terdistorsi.
        </div>
      </div>
    </DashboardShell>
  )
}

/** useSearchParams needs a Suspense boundary for the static snapshot export. */
export default function OverviewPage() {
  return (
    <Suspense fallback={null}>
      <OverviewPageInner />
    </Suspense>
  )
}
