"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterBar } from "@/components/overview/filter-bar"
import { DetailFilterSelects } from "@/components/overview/detail-filters"
import { FindingsFeed } from "@/components/overview/findings-feed"
import { MonthlyPerformanceChart } from "@/components/charts/monthly-performance-chart"
import { DailyPerformanceChart } from "@/components/charts/daily-performance-chart"
import { PaceGauge } from "@/components/charts/pace-gauge"
import { ProgressBars } from "@/components/charts/progress-bars"
import { DualKpiCard, KpiCard } from "@/components/charts/kpi-card"
import { AffSelfChart } from "@/components/charts/aff-self-chart"
import { WaterfallChart } from "@/components/charts/waterfall-chart"
import { CompositionTrendChart } from "@/components/charts/composition-trend-chart"
import { CompositionTable, DIMENSION_COLORS } from "@/components/overview/composition-table"
import { CompositionDetail } from "@/components/overview/composition-detail"
import { DriverChart, DriverLegend, EntityGrowthChart } from "@/components/charts/driver-chart"
import { GmvCommissionChart, ROI_THRESHOLD, RoiChart } from "@/components/charts/roi-chart"
import { AcquisitionChart } from "@/components/charts/acquisition-chart"
import { SpendTable } from "@/components/overview/spend-table"
import { ContentFunnel } from "@/components/overview/content-funnel"
import { apiFetch } from "@/lib/api"
import { computeFindings } from "@/lib/findings"
import { formatIdr, formatMonthLabelFull, formatPercent, formatRp, formatRpFull } from "@/lib/format"
import { currentMonth } from "@/lib/date-range"
import { filtersToParams, useOverviewFilters } from "@/store/overview-filters"
import type {
  CompositionDimension,
  CompositionResult,
  DailyPerformancePoint,
  DriverDimension,
  DriverEntity,
  DriversResult,
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

const DIMENSION_LABELS: Record<CompositionDimension, string> = {
  pillar: "Pillar",
  category: "Category",
  format: "Format",
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export default function OverviewPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)

  const filters = useOverviewFilters()
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
  const [spend, setSpend] = useState<SpendResult | null>(null)
  const [funnel, setFunnel] = useState<FunnelResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null)
  const [detailRowVisible, setDetailRowVisible] = useState(true)
  const detailRowRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  const detailKey = JSON.stringify(detail)
  const detailParams = Object.fromEntries(
    Object.entries(detail).filter(([, v]) => Boolean(v)),
  ) as Record<string, string>
  const prevParams =
    compare === "custom" && prevFrom && prevTo ? { prevFrom, prevTo } : ({} as Record<string, string>)

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
    spendEntity,
    detailKey,
    prevFrom,
    prevTo,
  ])

  useEffect(() => {
    const el = detailRowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setDetailRowVisible(entry?.isIntersecting ?? true),
      { rootMargin: "-72px 0px 0px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    apiFetch<FilterOptionsResult>(
      `/api/overview/filter-options${buildQuery({ from, to, brand: brand ?? undefined, marketplace: marketplace ?? undefined })}`,
    )
      .then(setFilterOptions)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load filter options"))
  }, [from, to, brand, marketplace])

  useEffect(() => {
    const year = new Date().getFullYear()
    apiFetch<MonthlyPerformanceResult>(
      `/api/overview/monthly-performance${buildQuery({ year: String(year), brand: brand ?? undefined, marketplace: marketplace ?? undefined })}`,
    )
      .then(setMonthly)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load monthly performance"))
  }, [brand, marketplace])

  useEffect(() => {
    apiFetch<DailyPerformancePoint[]>(
      `/api/overview/daily-performance${buildQuery({ month, brand: brand ?? undefined, marketplace: marketplace ?? undefined })}`,
    )
      .then(setDaily)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load daily performance"))
  }, [month, brand, marketplace])

  useEffect(() => {
    apiFetch<ProgressResult>(
      `/api/overview/progress${buildQuery({ month, brand: brand ?? undefined, marketplace: marketplace ?? undefined })}`,
    )
      .then(setProgress)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load progress"))
  }, [month, brand, marketplace])

  useEffect(() => {
    apiFetch<SummaryResult>(
      `/api/overview/summary${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        brand: brand ?? undefined,
        marketplace: marketplace ?? undefined,
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load summary"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    apiFetch<CompositionResult>(
      `/api/overview/composition${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        dimension,
        brand: brand ?? undefined,
        marketplace: marketplace ?? undefined,
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then(setComposition)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load composition"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, dimension, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    apiFetch<DriversResult>(
      `/api/overview/drivers${buildQuery({
        from,
        to,
        compare,
        entity: driverEntity,
        dimension: driverDimension,
        brand: brand ?? undefined,
        marketplace: marketplace ?? undefined,
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then(setDrivers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load drivers"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, driverEntity, driverDimension, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    apiFetch<SpendResult>(
      `/api/overview/spend${buildQuery({
        from,
        to,
        compare,
        granularity: trendGranularity,
        entity: spendEntity,
        brand: brand ?? undefined,
        marketplace: marketplace ?? undefined,
        ...detailParams,
        ...prevParams,
      })}`,
    )
      .then(setSpend)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load spend"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, compare, trendGranularity, spendEntity, brand, marketplace, detailKey, prevFrom, prevTo])

  useEffect(() => {
    apiFetch<FunnelResult>(
      `/api/overview/funnel${buildQuery({
        from,
        to,
        compare,
        brand: brand ?? undefined,
        marketplace: marketplace ?? undefined,
      })}`,
    )
      .then(setFunnel)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load funnel"))
  }, [from, to, compare, brand, marketplace])

  const onMonthClick = useCallback((clickedMonth: string) => setMonth(clickedMonth), [setMonth])

  const compareLabel =
    compare === "ly" ? "vs LY" : compare === "custom" ? "vs periode pembanding" : "vs prev period"
  const findings = computeFindings(monthly?.pace, summary?.kpis, progress, compareLabel, summary?.trend)

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
        mergeDetail={!detailRowVisible}
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
                    <div className="text-xs text-[var(--ov-mut)]">Time elapsed</div>
                    <div className="text-base font-bold font-(family-name:--font-archivo)">
                      {monthly.pace.daysElapsed}/{monthly.pace.daysInMonth} days
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
            <DailyPerformanceChart days={daily} />
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

        {/* Detail filter row — scopes Summary and everything below it */}
        <div
          ref={detailRowRef}
          className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] p-3.5"
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
              Filter rincian
            </span>
            <span className="text-[11.5px] leading-relaxed text-[var(--ov-faint)]">
              Mengikat Summary dan seksi di bawahnya. Seksi target di atas memakai bulan yang dipilih pada grafik
              tahunan, karena tabel target tidak punya kolom pillar/kategori.
            </span>
            {Object.values(detail).filter(Boolean).length > 0 && (
              <button
                type="button"
                onClick={filters.clearDetailFilters}
                className="ml-auto text-[11.5px] font-semibold text-[var(--accent-foreground)]"
              >
                Reset filter rincian
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {filterOptions ? (
              <DetailFilterSelects options={filterOptions.dimensions} />
            ) : (
              <span className="text-xs text-[var(--ov-faint)]">Memuat pilihan filter…</span>
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
                <SelectItem value="pillar">Pillar</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="format">Format</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">?</span>
          </div>

          {composition ? (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <div className="text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
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
                <div className="mb-2 text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                  Over the time in current period
                </div>
                <CompositionTrendChart
                  trend={composition.trend}
                  names={composition.rows.map((r) => r.name)}
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
              onValueChange={(v) => v && filters.setDriverDimension(v as DriverDimension)}
            >
              <SelectTrigger className="h-8 w-36 bg-[var(--input)] text-sm">
                <SelectValue>{(v: string) => (v === "format" ? "Product Format" : "Category")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="format">Product Format</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              are driving growth or causing losses per
            </span>
            <Select value={driverEntity} onValueChange={(v) => v && filters.setDriverEntity(v as DriverEntity)}>
              <SelectTrigger className="h-8 w-32 bg-[var(--input)] text-sm">
                <SelectValue>{(v: string) => (v === "brand" ? "Brand" : "Marketplace")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {drivers ? (
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <div className="mb-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] p-1.5 text-center text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                  Composition
                </div>
                <DriverChart rows={drivers.composition} names={drivers.names} />
              </div>
              <div>
                <div className="mb-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] p-1.5 text-center text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                  Growth GMV
                </div>
                <EntityGrowthChart rows={drivers.entityGrowth} />
              </div>
              <div>
                <div className="mb-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] p-1.5 text-center text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
                  GMV Difference
                </div>
                <DriverChart rows={drivers.difference} names={drivers.names} />
              </div>
              <DriverLegend names={drivers.names} />
            </div>
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
              Funnel &amp; pillar stats dari summary order. Belum tersedia: {funnel?.unavailable.join(", ") ?? "—"}.
            </span>
          </div>
          {funnel ? (
            <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
              {funnel.marketplaces.map((m) => (
                <ContentFunnel key={m.name} marketplace={m} />
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
            {summary ? <GmvCommissionChart trend={summary.trend} /> : null}

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
            <div className="mb-1 flex gap-4 text-xs text-[var(--ov-mut2)]">
              <span className="flex items-center gap-1.5">
                <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "#3c5a7e" }} />
                GMV
              </span>
              <span className="flex items-center gap-1.5">
                <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ov-gold)" }} />
                Creator Acquisition (creator baru {compareLabel})
              </span>
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
