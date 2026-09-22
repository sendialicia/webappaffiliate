"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { TtFilterBar, TT_LEVEL_LABELS } from "@/components/tiktok-pid/filter-bar"
import { TtCategoryTable } from "@/components/tiktok-pid/category-table"
import { TtProductTable } from "@/components/tiktok-pid/product-table"
import { TtProductDetailCard } from "@/components/tiktok-pid/product-detail"
import { CreatorDetailModal } from "@/components/creator-detail-modal"
import { OpportunityCreators } from "@/components/opportunity-creators"
import { TtTopCreatorsTable } from "@/components/tiktok-pid/top-creators-table"
import { ProductQuadrant, QuadrantInfo } from "@/components/charts/product-quadrant"
import { TT_QUADRANT_PRESETS } from "@/components/charts/tiktok-quadrant"
import { MetricTrend } from "@/components/charts/metric-trend"
import { apiFetch } from "@/lib/api"
import { formatIdr, formatPercent } from "@/lib/format"
import { ttFiltersToParams, useTiktokPidFilters } from "@/store/tiktok-pid-filters"
import type { DownloadItem } from "@/components/download-menu"
import type { FilterOptionsResult } from "@/types/overview"
import type {
  TtCategoriesResult,
  TtCreatorsResult,
  TtProductDetail,
  TtProductsResult,
  TtQuadrantPreset,
  TtTrendPoint,
} from "@/types/tiktok-pid"

/** How many lassoed products the combined deep dive will load at once. */
const DEEP_DIVE_LIMIT = 50

const SECTION_NAV = [
  { id: "tp-sec-1", label: "1 · Category" },
  { id: "tp-sec-2", label: "Category deep dive" },
  { id: "tp-sec-2b", label: "Product quadrant" },
  { id: "tp-sec-3", label: "2 · Product" },
  { id: "tp-sec-4", label: "Product deep dive" },
]

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

function TiktokPidPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)

  const filters = useTiktokPidFilters()
  const {
    brand,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    detail: pidDetail,
    selectedPids,
    countFilter,
    quadrantSelection,
    creatorLimit,
    quadrant,
    excludeOutliers,
    search,
    creatorPillar,
    creatorManaged,
    prevFrom,
    prevTo,
    hydrateFromParams,
    setScope,
    setSelectedPids,
    toggleSelectedPid,
    setCountFilter,
    setQuadrantSelection,
    setCreatorLimit,
    toggleScope,
  } = filters

  const prevParams =
    compare === "custom" && prevFrom && prevTo ? { prevFrom, prevTo } : ({} as Record<string, string>)

  const detailParams = Object.fromEntries(
    Object.entries(pidDetail)
      .filter(([, v]) => v && v.length > 0)
      .map(([k, v]) => [k, (v as string[]).join(",")]),
  ) as Record<string, string>
  const detailKey = JSON.stringify(pidDetail)

  const [categories, setCategories] = useState<TtCategoriesResult | null>(null)
  const [products, setProducts] = useState<TtProductsResult | null>(null)
  const [trend, setTrend] = useState<TtTrendPoint[] | null>(null)
  const [detail, setDetail] = useState<{ key: string; data: TtProductDetail } | null>(null)
  const [creators, setCreators] = useState<TtCreatorsResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null)
  const [showPillars, setShowPillars] = useState(true)
  const [showTiktok, setShowTiktok] = useState(true)
  // TikTok carries a full impression-to-cart funnel that Shopee has no equivalent for; it is
  // off by default so the table stays readable at the width the other pages use.
  const [showFunnel, setShowFunnel] = useState(false)
  // Which section the reader last touched, so the download menu can offer it first.
  const [lastSection, setLastSection] = useState<string | null>(null)
  const [scopeRowVisible, setScopeRowVisible] = useState(true)
  const scopeRowRef = useRef<HTMLDivElement>(null)
  // Which creator row opened the pop-up; null keeps it closed and unfetched.
  const [openCreator, setOpenCreator] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hydrateFromParams(searchParams)
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    router.replace(`${pathname}?${ttFiltersToParams(filters).toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    selectedPids,
    quadrant,
    excludeOutliers,
    search,
    creatorPillar,
    creatorManaged,
    prevFrom,
    prevTo,
  ])

  useEffect(() => {
    let stale = false
    apiFetch<FilterOptionsResult>(
      `/api/overview/filter-options${buildQuery({ from, to, marketplace: "Tiktok" })}`,
    )
      .then((data) => {
        if (!stale) setFilterOptions(data)
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [from, to])

  useEffect(() => {
    const el = scopeRowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setScopeRowVisible(entry?.isIntersecting ?? true),
      { rootMargin: "-72px 0px 0px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scopeQuery = {
    brand: csv(brand),
    from,
    to,
    compare,
    level,
    scope: csv(scope),
    ...prevParams,
    ...detailParams,
  }

  useEffect(() => {
    let stale = false
    apiFetch<TtCategoriesResult>(
      `/api/tiktok-pid/categories${buildQuery({ brand: csv(brand), from, to, compare, level, ...prevParams, ...detailParams })}`,
    )
      .then((data) => {
        if (!stale) setCategories(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Gagal memuat kategori")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, compare, prevFrom, prevTo, level, detailKey])

  useEffect(() => {
    let stale = false
    apiFetch<TtProductsResult>(`/api/tiktok-pid/products${buildQuery(scopeQuery)}`)
      .then((data) => {
        if (!stale) setProducts(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Gagal memuat produk")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, compare, prevFrom, prevTo, level, scope, detailKey])

  useEffect(() => {
    let stale = false
    apiFetch<TtTrendPoint[]>(
      `/api/tiktok-pid/trend${buildQuery({ ...scopeQuery, granularity: trendGranularity })}`,
    )
      .then((data) => {
        if (!stale) setTrend(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Gagal memuat trend")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, level, scope, trendGranularity, detailKey])

  const selectedKey = selectedPids.join(",")

  // The request URL doubles as the identity of the loaded detail. Matching on the
  // response's own pids breaks as soon as several are selected, because the API
  // returns them ordered by GMV and drops any with no rows in the window.
  const detailUrl = selectedKey
    ? `/api/tiktok-pid/product-detail${buildQuery({
        pid: selectedKey,
        brand: csv(brand),
        from,
        to,
        compare,
        granularity: trendGranularity,
        ...prevParams,
        ...detailParams,
      })}`
    : null

  useEffect(() => {
    if (!detailUrl) return
    apiFetch<TtProductDetail>(detailUrl)
      .then((data) => setDetail({ key: detailUrl, data }))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat detail produk"))
  }, [detailUrl])

  useEffect(() => {
    let stale = false
    apiFetch<TtCreatorsResult>(
      `/api/tiktok-pid/top-creators${buildQuery({
        ...scopeQuery,
        // With a product selected the table answers "who sells this product"; without one it
        // falls back to the active category, which is the question the page opens on.
        pid: selectedKey || undefined,
        crPillar: creatorPillar ?? undefined,
        managed: creatorManaged === null ? undefined : String(creatorManaged),
        limit: String(creatorLimit),
      })}`,
    )
      .then((data) => {
        if (!stale) setCreators(data)
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Gagal memuat creator")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, level, scope, creatorPillar, creatorManaged, creatorLimit, detailKey, selectedKey])

  // One predicate for the count cards, shared by the product table and the quadrant, so a card
  // narrows both instead of only the table.
  const matchesCount = (r: { gmv: number; gmvPrev: number; growth: number | null }) =>
    countFilter === "growing"
      ? r.gmv > r.gmvPrev
      : countFilter === "decline"
        ? r.growth !== null && r.growth < 0
        : true

  const visibleProducts = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    return products.rows
      .filter((r) => r.inScope)
      .filter((r) => quadrantSelection.length === 0 || quadrantSelection.includes(r.pid))
      .filter(matchesCount)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.pid.toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, countFilter, quadrantSelection])

  // Products outside the active count card stay on the plot as grey context points, so the
  // axes and medians do not jump when a card is clicked — only the highlighted set changes.
  const quadrantRows = useMemo(
    () => (products?.rows ?? []).map((r) => ({ ...r, inScope: r.inScope && matchesCount(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, countFilter],
  )

  // The overview's filter-options endpoint already lists the PID dimension values.
  const dimensionOptions: Partial<Record<string, string[]>> = Object.fromEntries(
    (filterOptions?.dimensions ?? []).map((d) => [d.key, d.values]),
  )

  const scopeLabel =
    scope.length === 0
      ? `Seluruh ${TT_LEVEL_LABELS[level].toLowerCase()}`
      : scope.length <= 2
        ? scope.join(" + ")
        : `${scope.length} ${TT_LEVEL_LABELS[level].toLowerCase()} dipilih`

  // Built from the same state each section renders — the product list follows the active
  // count-card filter and search box, not the unfiltered response.
  const downloads: DownloadItem[] = [
    {
      id: "kategori",
      label: `Tabel ${TT_LEVEL_LABELS[level]}`,
      rows: () =>
        categories
          ? [categories.total, ...categories.rows].map(({ pillars, pillarGrowth, ...r }) => ({
              ...r,
              livestream: pillars.livestream,
              video: pillars.video,
              productCard: pillars.productCard,
              livestreamGrowth: pillarGrowth.livestream,
              videoGrowth: pillarGrowth.video,
              productCardGrowth: pillarGrowth.productCard,
            }))
          : [],
    },
    {
      id: "gmv-trend",
      label: `GMV trend · ${scopeLabel}`,
      rows: () => (trend ?? []).map((t) => ({ ...t })),
    },
    {
      id: "quadrant",
      label: `Product quadrant · ${TT_QUADRANT_PRESETS[quadrant].name}`,
      rows: () =>
        (products?.rows ?? [])
          .filter((r) => r.inScope)
          .map(({ pillars, ...r }) => ({
            ...r,
            livestream: pillars.livestream,
            video: pillars.video,
            productCard: pillars.productCard,
          })),
    },
    {
      id: "produk",
      label: `Tabel produk (${visibleProducts.length} baris tampil)`,
      rows: () =>
        visibleProducts.map(({ pillars, ...r }) => ({
          ...r,
          livestream: pillars.livestream,
          video: pillars.video,
          productCard: pillars.productCard,
        })),
    },
    {
      id: "product-deep-dive",
      label: "Product deep dive · pillar",
      rows: () => (detail ? detail.data.pillars.map((p) => ({ produk: detail.data.name, ...p })) : []),
    },
    {
      id: "top-creators",
      label: "Top creators",
      rows: () =>
        (creators?.rows ?? []).map(({ pillars, ...r }) => ({
          ...r,
          livestream: pillars.livestream,
          video: pillars.video,
          productCard: pillars.productCard,
        })),
    },
  ]

  return (
    <DashboardShell
      title="Product — TikTok PID"
      subtitle="Kategori dan produk mana yang menggerakkan GMV TikTok."
      active="tiktok-pid"
      sectionNav={SECTION_NAV}
    >
      <TtFilterBar
        brandOptions={filterOptions?.brands ?? BRAND_OPTIONS}
        dimensionOptions={dimensionOptions}
        mergeScope={!scopeRowVisible}
        downloads={downloads}
        lastSection={lastSection}
      />

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-4 py-3 text-sm text-[var(--ov-red-ink)] md:mx-8">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
        {/* 1 · Category */}
        <SectionHeading id="tp-sec-1" step="1 · Category" />

        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              Which {TT_LEVEL_LABELS[level]} is Driving Our TikTok GMV Growth?
            </span>
            <div className="ml-auto flex items-center gap-2">
              <ToggleChip active={showPillars} onClickAction={() => setShowPillars((v) => !v)} label="Kolom pillar" />
              <ToggleChip active={showTiktok} onClickAction={() => setShowTiktok((v) => !v)} label="Kolom TikTok" />
              <ToggleChip active={showFunnel} onClickAction={() => setShowFunnel((v) => !v)} label="Kolom funnel" />
            </div>
          </div>
          <div className="mb-3 text-[13px] leading-relaxed text-[var(--ov-faint)]">
            Klik baris untuk mengikat seluruh seksi di bawah ke cakupan itu · growth, Δ Rp dan share dihitung{" "}
            {compare === "ly" ? "vs LY" : "vs periode sebelumnya"} · kolom TikTok (TT) dari affiliate centre,{" "}
            <span className="font-semibold text-[var(--ov-soft)]">Commission dan ROI dari data internal</span>.
          </div>
          {categories ? (
            <TtCategoryTable
              total={categories.total}
              rows={categories.rows}
              scope={scope}
              onScopeAction={(names) => {
                setScope(names)
                setLastSection("kategori")
              }}
              onToggleScopeAction={(name) => {
                toggleScope(name)
                setLastSection("kategori")
              }}
              showPillars={showPillars}
              showTiktok={showTiktok}
              showFunnel={showFunnel}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 2 · Deep dive */}
        <div id="tp-sec-2" className="scroll-mt-24">
          <div ref={scopeRowRef} className="mb-3.5 flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold-ink)] font-(family-name:--font-archivo)">
              {TT_LEVEL_LABELS[level]} Deep Dive
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-foreground)]">
              {scopeLabel}
            </span>
            {scope.length > 0 && (
              <button
                type="button"
                onClick={() => setScope([])}
                className="rounded-full border border-[var(--ov-line)] px-3 py-1.5 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
              >
                Kembali ke seluruh {TT_LEVEL_LABELS[level].toLowerCase()}
              </button>
            )}
            <span className="text-[13px] text-[var(--ov-faint)]">
              mengikat count card, GMV trend, quadrant, dan tabel produk di bawah
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
              <CountCard
                label="Count Product"
                value={products ? formatIdr(products.countProduct) : "…"}
                note="produk dengan transaksi pada cakupan ini"
                active={countFilter === "all"}
                onClickAction={() => setCountFilter("all")}
              />
              <CountCard
                label="Count Growing Product"
                value={products ? formatIdr(products.countGrowingProduct) : "…"}
                note={`GMV-nya naik ${compare === "ly" ? "vs LY" : "vs periode pembanding"}, termasuk produk baru`}
                color="var(--ov-green-ink)"
                active={countFilter === "growing"}
                onClickAction={() => setCountFilter("growing")}
              />
              <CountCard
                label="Count Declining Product"
                value={products ? formatIdr(products.countDecliningProduct) : "…"}
                note={`GMV-nya turun ${compare === "ly" ? "vs LY" : "vs periode pembanding"}`}
                color="var(--ov-red-ink)"
                active={countFilter === "decline"}
                onClickAction={() => setCountFilter("decline")}
              />
            </div>
            <div
              className="rounded-xl border border-[var(--ov-line)] p-4 lg:col-span-2"
              style={{ background: "var(--ov-card-gradient)" }}
            >
              <MetricTrend
                data={trend}
                title={`Trend · ${scopeLabel}`}
                picker="select"
                headerExtra={<span className="text-[13px] text-[var(--ov-faint)]">granularitas {trendGranularity}</span>}
              />
            </div>
          </div>
        </div>

        {/* 2b · Quadrant */}
        <div
          id="tp-sec-2b"
          className="scroll-mt-24 rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">Product Quadrant</span>
            <span className="text-[13px] text-[var(--ov-faint)]">(klik titik emas untuk membuka produknya di deep dive)</span>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <ToggleChip
                active={excludeOutliers}
                onClickAction={() => filters.setExcludeOutliers(!excludeOutliers)}
                label="Kecualikan outlier dari skala"
              />
              <Select value={quadrant} onValueChange={(v) => v && filters.setQuadrant(v as TtQuadrantPreset)}>
                <SelectTrigger className="h-8 w-72 bg-[var(--input)] text-sm">
                  <SelectValue>{(v: string) => TT_QUADRANT_PRESETS[v as TtQuadrantPreset]?.name ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TT_QUADRANT_PRESETS) as TtQuadrantPreset[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TT_QUADRANT_PRESETS[k].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuadrantInfo spec={TT_QUADRANT_PRESETS[quadrant]} excludeOutliers={excludeOutliers} />
              {quadrantSelection.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuadrantSelection([])}
                  className="rounded-full border border-[var(--ov-line)] px-3 py-1.5 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
                >
                  Lepas {quadrantSelection.length} produk terpilih
                </button>
              )}
            </div>
          </div>
          {products ? (
            <ProductQuadrant
              rows={quadrantRows}
              spec={TT_QUADRANT_PRESETS[quadrant]}
              excludeOutliers={excludeOutliers}
              selectedPids={quadrantSelection}
              onSelectManyAction={(pids) => {
                setQuadrantSelection(pids)
                // The detail endpoint takes the ids in the query string, so a huge lasso
                // narrows the table but only opens a readable slice in the deep dive.
                setSelectedPids(pids.slice(0, DEEP_DIVE_LIMIT))
                setLastSection("quadrant")
              }}
              onSelectAction={(pid) => setSelectedPids([pid])}
            />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 3 · Product */}
        <SectionHeading id="tp-sec-3" step="2 · Product" note={`cakupan: ${scopeLabel}`} />

        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-3.5">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="min-w-[260px] flex-1 text-lg font-semibold font-(family-name:--font-archivo)">
              Which Specific Products are Steering the Growth or Pulling Down Performance?
            </span>
            <Input
              value={search}
              onChange={(e) => filters.setSearch(e.target.value)}
              placeholder="Cari nama atau product ID"
              className="h-8 w-56 bg-[var(--input)] text-sm"
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5 text-xs text-[var(--ov-faint)]">
            <span>
              {visibleProducts.length} produk ditampilkan
              {products ? ` dari ${products.countProduct} pada cakupan ini` : ""}
            </span>
            <span className="ml-auto">
              klik baris untuk deep dive · shift-klik untuk rentang · ⌘/ctrl-klik untuk tambah satu · centang kotak
              di header untuk pilih semua
            </span>
          </div>
          {products ? (
            <TtProductTable
              rows={visibleProducts}
              selectedPids={selectedPids}
              onSelectAction={(pid) => {
                setSelectedPids([pid])
                setLastSection("produk")
              }}
              onToggleAction={(pid) => {
                toggleSelectedPid(pid)
                setLastSection("produk")
              }}
              onSetSelectionAction={setSelectedPids}
              showPillars={showPillars}
              showTiktok={showTiktok}
              showFunnel={showFunnel}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 4 · Product deep dive + creators */}
        <div id="tp-sec-4" className="grid scroll-mt-24 grid-cols-1 gap-4.5 xl:grid-cols-2">
          <div className="flex flex-col">
            <div className="mb-3.5 flex min-h-[42px] flex-wrap items-center gap-3">
              <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold-ink)] font-(family-name:--font-archivo)">
                Product Deep Dive
              </div>
              <span className="text-[13px] text-[var(--ov-faint)]">mengikuti baris produk yang dipilih di tabel atas</span>
            </div>
            {detailUrl && detail?.key === detailUrl ? (
              <TtProductDetailCard detail={detail.data} onRemoveAction={toggleSelectedPid} />
            ) : (
              <div
                className="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--ov-line)] px-6 text-center text-sm text-[var(--ov-faint)]"
                style={{ background: "var(--ov-card-gradient)" }}
              >
                {selectedKey
                  ? "Memuat detail produk…"
                  : "Klik satu baris produk untuk melihat detailnya, atau centang beberapa baris untuk menggabungkannya."}
              </div>
            )}
          </div>

          {/* The creators column takes the deep-dive column's height instead of setting its own:
              on xl it is pulled out of flow (absolute) so the left card alone sizes the row, and
              the table scrolls inside. The min height keeps it usable before a product is picked. */}
          <div className="flex flex-col xl:relative xl:min-h-[720px]">
            <div className="flex flex-col xl:absolute xl:inset-0">
            <div className="mb-3.5 flex min-h-[42px] flex-wrap items-center gap-3.5">
              <div className="flex items-center gap-2.5">
                <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
                <span className="text-[17px] font-semibold font-(family-name:--font-archivo)">
                  Who are the Top Creators by Pillars?
                </span>
                <span className="rounded-full border border-[var(--ov-line)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--ov-soft)]">
                  {selectedKey ? "produk terpilih" : scopeLabel}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2.5">
                <Select
                  value={creatorPillar ?? "__all__"}
                  onValueChange={(v) => v && filters.setCreatorPillar(v === "__all__" ? null : v)}
                >
                  <SelectTrigger className="h-7 w-32 bg-[var(--input)] text-xs">
                    <SelectValue>{(v: string) => (v === "__all__" || !v ? "Semua pillar" : v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua pillar</SelectItem>
                    <SelectItem value="Livestream">Livestream</SelectItem>
                    <SelectItem value="Video">Video</SelectItem>
                    <SelectItem value="Product Card">Product Card</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={creatorManaged === null ? "__all__" : String(creatorManaged)}
                  onValueChange={(v) => v && filters.setCreatorManaged(v === "__all__" ? null : v === "true")}
                >
                  <SelectTrigger className="h-7 w-28 bg-[var(--input)] text-xs">
                    <SelectValue>
                      {(v: string) => (v === "__all__" || !v ? "Semua" : v === "true" ? "Managed" : "Organic")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua</SelectItem>
                    <SelectItem value="true">Managed</SelectItem>
                    <SelectItem value="false">Organic</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(creatorLimit)} onValueChange={(v) => v && setCreatorLimit(Number(v))}>
                  <SelectTrigger className="h-7 w-24 bg-[var(--input)] text-xs">
                    <SelectValue>{(v: string) => `Top ${v}`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Top {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
              style={{ background: "var(--ov-card-gradient)" }}
            >
              {creators ? (
                <>
                  <div className="min-h-0 flex-1">
                    <TtTopCreatorsTable rows={creators.rows} onSelectAction={setOpenCreator} />
                  </div>
                  <div className="mt-3 border-t border-[var(--ov-line)] pt-2.5 text-xs leading-relaxed text-[var(--ov-faint)]">
                    10 creator teratas menyumbang {formatPercent(creators.concentrationTop10)} dari total GMV{" "}
                    {formatIdr(creators.totalGmv)} pada cakupan ini.
                  </div>
                </>
              ) : (
                <div className="flex h-[240px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
              )}
            </div>
            {/* Right under the top creators, not at the page bottom: these are the ones to act on,
                so they share the column and split its height rather than scroll out of view. */}
            <div className="mt-3.5 flex min-h-0 flex-col overflow-auto xl:flex-1">
              <OpportunityCreators
                endpoint="/api/tiktok-pid/opportunity-creators"
                idParam="pid"
                ids={selectedKey}
                query={{ brand: csv(brand), from, to, ...detailParams }}
              />
            </div>
            </div>
          </div>
        </div>


        <div className="text-xs leading-relaxed text-[var(--ov-faint)]">
          Catatan data: baris dengan <span className="font-mono">AFFILIATE_USERNAME = &ldquo;Agency&rdquo;</span> adalah
          agregat penjualan agency, bukan creator individual — di TikTok porsinya besar, sehingga Creators dan GMV per
          creator ikut terdistorsi. TikTok affiliate centre juga tidak mengirim estimasi komisi
          (<span className="font-mono">TT_AFF_CENTER_EST_COMMISSION</span> kosong), jadi Commission dan ROI di halaman
          ini memakai kolom komisi internal. &ldquo;Customers / hari&rdquo; adalah rata-rata harian dari
          <span className="font-mono"> TT_AVG_DAILY_CUSTOMERS</span>, dirata-ratakan atas hari yang benar-benar ada
          datanya — bukan jumlah pembeli sepanjang periode.
        </div>
      </div>

      <CreatorDetailModal
        endpoint="/api/tiktok-pid/creator-detail"
        username={openCreator}
        query={{ brand: csv(brand), from, to, granularity: trendGranularity, ...detailParams }}
        onCloseAction={() => setOpenCreator(null)}
      />
    </DashboardShell>
  )
}

const BRAND_OPTIONS = [
  "Wardah",
  "OMG",
  "Make Over",
  "Kahf",
  "Labore",
  "Emina",
  "Light+",
  "Putri",
  "Instaperfect",
  "Earth Love Life",
  "Biodef",
  "Tavi",
  "Crystallure",
]

function SectionHeading({ id, step, note }: { id?: string; step: string; note?: string }) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-wrap items-center gap-3.5">
      <span className="flex-none rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[13px] font-bold tracking-widest text-[var(--accent-foreground)] uppercase font-(family-name:--font-archivo)">
        {step}
      </span>
      {note && <span className="flex-none text-[13px] text-[var(--ov-faint)]">({note})</span>}
      <span className="h-px min-w-[40px] flex-1 bg-[var(--ov-line)]" />
    </div>
  )
}

function ToggleChip({
  active,
  onClickAction,
  label,
}: {
  active: boolean
  onClickAction: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      className="rounded-md border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
      style={{
        borderColor: active ? "var(--accent)" : "var(--ov-line)",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent-foreground)" : "var(--ov-mut)",
      }}
    >
      {label}
    </button>
  )
}

function CountCard({
  label,
  value,
  note,
  color,
  active,
  onClickAction,
}: {
  label: string
  value: string
  note: string
  color?: string
  /** The card doubles as the product table's filter, the way the reference mockup uses it. */
  active: boolean
  onClickAction: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      title="Klik untuk menyaring tabel produk di bawah"
      className="rounded-xl border-2 p-4 text-left shadow-[0_18px_34px_-22px_var(--ov-shadow)] hover:border-[var(--accent)]"
      style={{
        background: active ? "var(--ov-card-gradient-soft)" : "var(--ov-card-gradient)",
        borderColor: active ? "var(--accent-foreground)" : "var(--ov-line)",
      }}
    >
      <div className="flex items-center gap-2 text-[13px] leading-snug font-semibold text-[var(--ov-mut)]">
        {label}
        {active && (
          <span className="ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--accent-foreground)]">
            menyaring tabel
          </span>
        )}
      </div>
      <div
        className="mt-2 text-3xl font-bold tracking-tight font-(family-name:--font-archivo)"
        style={{ color: color ?? "var(--ov-ink)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">{note}</div>
    </button>
  )
}

/** useSearchParams needs a Suspense boundary for the static snapshot export. */
export default function TiktokPidPage() {
  return (
    <Suspense fallback={null}>
      <TiktokPidPageInner />
    </Suspense>
  )
}
