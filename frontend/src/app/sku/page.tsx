"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { SkuFilterBar, skuLevelLabel } from "@/components/sku/filter-bar"
import { SkuCategoryTable } from "@/components/sku/category-table"
import { SkuProductTable } from "@/components/sku/product-table"
import { SkuDetailCard } from "@/components/sku/detail"
import { CreatorDetailModal } from "@/components/creator-detail-modal"
import { OpportunityCreators } from "@/components/opportunity-creators"
import { SkuTopCreatorsTable } from "@/components/sku/top-creators-table"
import { ProductQuadrant, QuadrantInfo } from "@/components/charts/product-quadrant"
import { SKU_QUADRANT_PRESETS, type SkuQuadrantRow } from "@/components/charts/sku-quadrant"
import { MetricTrend } from "@/components/charts/metric-trend"
import { apiFetch } from "@/lib/api"
import { formatIdr, formatPercent } from "@/lib/format"
import { skuFiltersToParams, useSkuFilters } from "@/store/sku-filters"
import type { DownloadItem } from "@/components/download-menu"
import { selectionLabel, selectionRows } from "@/lib/deep-dive-export"
import type { OpportunityCreatorsResult } from "@/types/shopee-pid"
import type { FilterOptionsResult } from "@/types/overview"
import type {
  SkuCategoriesResult,
  SkuCreatorsResult,
  SkuDetail,
  SkuFilterOptionsResult,
  SkuProductsResult,
  SkuQuadrantPreset,
  SkuTrendPoint,
} from "@/types/sku"

/** How many lassoed SKUs the combined deep dive will load at once. */
const DEEP_DIVE_LIMIT = 50

const SP_COLOR = "var(--ov-gold)"
const TT_COLOR = "var(--ov-blue)"

const SECTION_NAV = [
  { id: "sk-sec-1", label: "1 · Category" },
  { id: "sk-sec-2", label: "Category deep dive" },
  { id: "sk-sec-2b", label: "SKU quadrant" },
  { id: "sk-sec-3", label: "2 · SKU" },
  { id: "sk-sec-4", label: "SKU deep dive" },
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

function SkuPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)

  const filters = useSkuFilters()
  const {
    brand,
    marketplace,
    bundleType,
    bundleSplit,
    includeGwp,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    attributeBase,
    scope,
    detail: skuDetail,
    selectedBarcodes,
    countFilter,
    quadrantSelection,
    creatorLimit,
    quadrant,
    excludeOutliers,
    search,
    creatorManaged,
    prevFrom,
    prevTo,
    hydrateFromParams,
    setScope,
    setSelectedBarcodes,
    toggleSelectedBarcode,
    setCountFilter,
    setQuadrantSelection,
    setCreatorLimit,
    toggleScope,
  } = filters

  const prevParams =
    compare === "custom" && prevFrom && prevTo ? { prevFrom, prevTo } : ({} as Record<string, string>)

  const detailParams = Object.fromEntries(
    Object.entries(skuDetail)
      .filter(([, v]) => v && v.length > 0)
      .map(([k, v]) => [k, (v as string[]).join(",")]),
  ) as Record<string, string>
  const detailKey = JSON.stringify(skuDetail)

  // Both bundle controls travel on every request; they change which population is queried.
  const modeParams = {
    bundleSplit: bundleSplit ? undefined : "false",
    includeGwp: includeGwp ? "true" : undefined,
    bundleType: csv(bundleType),
    marketplace: csv(marketplace),
  }

  const [categories, setCategories] = useState<SkuCategoriesResult | null>(null)
  const [products, setProducts] = useState<SkuProductsResult | null>(null)
  const [trend, setTrend] = useState<SkuTrendPoint[] | null>(null)
  const [detail, setDetail] = useState<{ key: string; data: SkuDetail } | null>(null)
  const [creators, setCreators] = useState<SkuCreatorsResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResult | null>(null)
  const [skuOptions, setSkuOptions] = useState<SkuFilterOptionsResult | null>(null)
  const [showSplit, setShowSplit] = useState(true)
  const [showDetailCols, setShowDetailCols] = useState(false)
  // Which section the reader last touched, so the download menu can offer it first.
  const [lastSection, setLastSection] = useState<string | null>(null)
  const [scopeRowVisible, setScopeRowVisible] = useState(true)
  const scopeRowRef = useRef<HTMLDivElement>(null)
  // Which creator row opened the pop-up; null keeps it closed and unfetched.
  const [openCreator, setOpenCreator] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // How many picks the last filter change dropped, shown once in the deep dive instead of an error.
  const [droppedPicks, setDroppedPicks] = useState(0)
  // The last opportunity list the panel loaded, tagged with the selection it was loaded for.
  const [opportunity, setOpportunity] = useState<{ ids: string; data: OpportunityCreatorsResult } | null>(null)

  useEffect(() => {
    hydrateFromParams(searchParams)
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    router.replace(`${pathname}?${skuFiltersToParams(filters).toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand,
    marketplace,
    bundleType,
    bundleSplit,
    includeGwp,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    attributeBase,
    scope,
    selectedBarcodes,
    quadrant,
    excludeOutliers,
    search,
    creatorManaged,
    prevFrom,
    prevTo,
  ])

  useEffect(() => {
    let stale = false
    apiFetch<FilterOptionsResult>(`/api/overview/filter-options${buildQuery({ from, to })}`)
      .then((data) => {
        if (!stale) setFilterOptions(data)
      })
      .catch(() => undefined)
    apiFetch<SkuFilterOptionsResult>(`/api/sku/filter-options${buildQuery({ from, to })}`)
      .then((data) => {
        if (!stale) setSkuOptions(data)
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

  const modeKey = `${bundleSplit}|${includeGwp}|${bundleType.join(",")}|${marketplace.join(",")}`

  const scopeQuery = {
    brand: csv(brand),
    from,
    to,
    compare,
    level,
    attributeBase,
    scope: csv(scope),
    ...modeParams,
    ...prevParams,
    ...detailParams,
  }

  useEffect(() => {
    let stale = false
    apiFetch<SkuCategoriesResult>(
      `/api/sku/categories${buildQuery({ brand: csv(brand), from, to, compare, level, attributeBase, ...modeParams, ...prevParams, ...detailParams })}`,
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
  }, [brand, from, to, compare, prevFrom, prevTo, level, attributeBase, detailKey, modeKey])

  useEffect(() => {
    let stale = false
    apiFetch<SkuProductsResult>(`/api/sku/products${buildQuery(scopeQuery)}`)
      .then((data) => {
        if (stale) return
        setProducts(data)
        // Keep the selection to what the current filters can show, so a brand, period or
        // dimension change never leaves a dangling pick behind. Read from the store directly:
        // this callback may outlive the render that created it.
        const picked = useSkuFilters.getState().selectedBarcodes
        const available = new Set(data.rows.map((r) => r.barcode))
        const kept = picked.filter((id) => available.has(id))
        if (kept.length !== picked.length) {
          setSelectedBarcodes(kept)
          setDroppedPicks(picked.length - kept.length)
        }
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Gagal memuat SKU")
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, compare, prevFrom, prevTo, level, attributeBase, scope, detailKey, modeKey])

  useEffect(() => {
    let stale = false
    apiFetch<SkuTrendPoint[]>(`/api/sku/trend${buildQuery({ ...scopeQuery, granularity: trendGranularity })}`)
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
  }, [brand, from, to, level, attributeBase, scope, trendGranularity, detailKey, modeKey])

  const selectedKey = selectedBarcodes.join(",")

  // The request URL doubles as the identity of the loaded detail — matching on the response's
  // own barcodes breaks once several are selected, since the API orders them by GMV.
  const detailUrl = selectedKey
    ? `/api/sku/detail${buildQuery({
        barcode: selectedKey,
        brand: csv(brand),
        from,
        to,
        compare,
        attributeBase,
        granularity: trendGranularity,
        ...modeParams,
        ...prevParams,
        ...detailParams,
      })}`
    : null

  useEffect(() => {
    if (!detailUrl) return
    apiFetch<SkuDetail>(detailUrl)
      .then((data) => setDetail({ key: detailUrl, data }))
      .catch((e) => {
        const text = e instanceof Error ? e.message : "Gagal memuat detail SKU"
        // A picked SKU with no sales under the new filters is not an error: the pruning below
        // drops it from the selection, and the deep dive falls back to its empty state.
        if (/not found/i.test(text)) return
        setError(text)
      })
  }, [detailUrl])

  // The notice is about the last filter change only; the reader's next pick retires it.
  const [noticeKey, setNoticeKey] = useState("")
  if (selectedKey && noticeKey !== selectedKey) {
    setNoticeKey(selectedKey)
    if (droppedPicks > 0) setDroppedPicks(0)
  }


  useEffect(() => {
    let stale = false
    apiFetch<SkuCreatorsResult>(
      `/api/sku/top-creators${buildQuery({
        ...scopeQuery,
        // With SKUs picked in the table the list answers "who sells these"; otherwise the scope.
        barcode: selectedKey || undefined,
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
  }, [brand, from, to, level, attributeBase, scope, creatorManaged, creatorLimit, detailKey, modeKey, selectedKey])

  // One predicate for the count cards, shared by the SKU table and the quadrant, so a card
  // narrows both instead of only the table.
  const matchesCount = (r: { crossMarketplace: boolean; shopee: { gmv: number }; tiktok: { gmv: number } }) =>
    countFilter === "cross"
      ? r.crossMarketplace
      : countFilter === "shopee"
        ? r.shopee.gmv > 0 && r.tiktok.gmv === 0
        : countFilter === "tiktok"
          ? r.tiktok.gmv > 0 && r.shopee.gmv === 0
          : true

  const visibleSkus = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    return products.rows
      .filter((r) => r.inScope)
      .filter((r) => quadrantSelection.length === 0 || quadrantSelection.includes(r.barcode))
      .filter(matchesCount)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.barcode.toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, countFilter, quadrantSelection])

  // The shared quadrant keys points by `pid`; here that identity is the barcode.
  const quadrantRows: SkuQuadrantRow[] = useMemo(
    // Rows outside the active count card stay as grey context points, so the axes do not jump.
    () => (products?.rows ?? []).map((r) => ({ ...r, pid: r.barcode, inScope: r.inScope && matchesCount(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, countFilter],
  )

  const dimensionOptions: Partial<Record<string, string[]>> = Object.fromEntries(
    (filterOptions?.dimensions ?? []).map((d) => [d.key, d.values]),
  )

  const scopeLabel =
    scope.length === 0
      ? `Seluruh ${skuLevelLabel(attributeBase, level).toLowerCase()}`
      : scope.length <= 2
        ? scope.join(" + ")
        : `${scope.length} ${skuLevelLabel(attributeBase, level).toLowerCase()} dipilih`

  const flatten = <T extends { shopee: unknown; tiktok: unknown }>(rows: T[]) =>
    rows.map(({ shopee, tiktok, ...r }) => {
      const sp = shopee as Record<string, number>
      const tt = tiktok as Record<string, number>
      return {
        ...r,
        shopeeGmv: sp.gmv,
        shopeeItemsSold: sp.itemsSold,
        shopeeOrders: sp.orders,
        shopeeCreators: sp.creators,
        tiktokGmv: tt.gmv,
        tiktokItemsSold: tt.itemsSold,
        tiktokOrders: tt.orders,
        tiktokCreators: tt.creators,
      }
    })

  // Only the detail that matches the current selection; a stale one would mislabel the file.
  const deepDive = detailUrl && detail?.key === detailUrl ? detail.data : null
  const deepDiveHint = !selectedKey ? "Pilih SKU di tabel dulu" : !deepDive ? "Detail SKU masih dimuat…" : null
  const freshOpportunity = opportunity && opportunity.ids === selectedKey ? opportunity.data : null
  const selectionCell = deepDive ? selectionLabel(deepDive.barcodes) : ""

  const downloads: DownloadItem[] = [
    {
      id: "kategori",
      label: `Tabel ${skuLevelLabel(attributeBase, level)}`,
      group: "Category",
      rows: () => (categories ? flatten([categories.total, ...categories.rows]) : []),
    },
    {
      id: "gmv-trend",
      label: `GMV trend · ${scopeLabel}`,
      group: "Category",
      rows: () => (trend ?? []).map((t) => ({ ...t })),
    },
    {
      id: "quadrant",
      label: `SKU quadrant · ${SKU_QUADRANT_PRESETS[quadrant].name}`,
      group: "Category",
      rows: () => flatten((products?.rows ?? []).filter((r) => r.inScope)),
    },
    {
      id: "sku",
      label: `Tabel SKU (${visibleSkus.length} baris tampil)`,
      group: "SKU",
      rows: () => flatten(visibleSkus),
    },
    {
      id: "sku-terpilih",
      label: `SKU terpilih (${selectedBarcodes.length})`,
      group: "SKU deep dive",
      disabledHint: deepDiveHint,
      rows: () =>
        selectionRows({
          selected: selectedBarcodes,
          rows: products?.rows ?? [],
          idOf: (r) => r.barcode,
          flatten: (r) => flatten([r])[0] ?? {},
          members: (deepDive?.members ?? []).map((m) => ({ id: m.barcode, name: m.name, gmv: m.gmv })),
          idColumn: "barcode",
          total: deepDive
            ? {
                barcode: selectionCell,
                name: `TOTAL (${deepDive.barcodes.length} SKU digabung)`,
                category: deepDive.category,
                subCategory: deepDive.subCategory,
                format: deepDive.format,
                ...(flatten([deepDive.totals])[0] ?? {}),
              }
            : null,
        }),
    },
    {
      id: "sku-deep-dive-trend",
      label: `Trend (${trendGranularity})`,
      group: "SKU deep dive",
      disabledHint: deepDiveHint,
      rows: () => (deepDive ? deepDive.trend.map((t) => ({ barcode: selectionCell, sku: deepDive.name, ...t })) : []),
    },
    {
      id: "sku-deep-dive",
      label: "Listing (PID) per marketplace",
      group: "SKU deep dive",
      disabledHint: deepDiveHint,
      rows: () => (deepDive ? deepDive.pids.map((p) => ({ barcode: selectionCell, sku: deepDive.name, ...p })) : []),
    },
    {
      id: "top-creators",
      label: `Top creators · ${selectedKey ? `${selectedBarcodes.length} SKU terpilih` : scopeLabel}`,
      group: "Creators",
      rows: () =>
        (creators?.rows ?? []).map((r) => ({ ...(selectedKey ? { barcode: selectionLabel(selectedBarcodes) } : {}), ...r })),
    },
    {
      id: "opportunity-creators",
      label: "Creator peluang",
      group: "Creators",
      disabledHint: !selectedKey
        ? "Pilih SKU di tabel dulu"
        : !freshOpportunity
          ? "Klik “Cari” di panel creator peluang dulu"
          : null,
      rows: () =>
        freshOpportunity
          ? freshOpportunity.rows.map((r) => ({
              barcode: selectionLabel(selectedBarcodes),
              subCategory: freshOpportunity.subCategory,
              ...r,
            }))
          : [],
    },
  ]

  return (
    <DashboardShell
      title="Product — SKU"
      subtitle="SKU yang sama di Shopee dan TikTok, disatukan lewat barcode."
      active="sku"
      sectionNav={SECTION_NAV}
    >
      <SkuFilterBar
        brandOptions={filterOptions?.brands ?? BRAND_OPTIONS}
        marketplaceOptions={skuOptions?.marketplaces ?? ["Shopee", "Tiktok"]}
        bundleTypeOptions={skuOptions?.bundleTypes ?? []}
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
        <SectionHeading id="sk-sec-1" step="1 · Category" />

        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              Which {skuLevelLabel(attributeBase, level)} is Driving Growth Across Both Marketplaces?
            </span>
            <div className="ml-auto flex items-center gap-2">
              <ToggleChip active={showSplit} onClickAction={() => setShowSplit((v) => !v)} label="Kolom per marketplace" />
              <ToggleChip
                active={showDetailCols}
                onClickAction={() => setShowDetailCols((v) => !v)}
                label="Kolom rinci"
              />
            </div>
          </div>
          <div className="mb-3 text-[13px] leading-relaxed text-[var(--ov-faint)]">
            Klik baris untuk mengikat seluruh seksi di bawah ke cakupan itu · growth dan Δ Rp dihitung{" "}
            {compare === "ly" ? "vs LY" : "vs periode sebelumnya"} · satu SKU dikenali lewat{" "}
            <span className="font-semibold text-[var(--ov-soft)]">barcode</span>, namanya diambil dari
            VARIANT_SAP_NAME terbaru.
          </div>
          {categories ? (
            <SkuCategoryTable
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
              showSplit={showSplit}
              showDetail={showDetailCols}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 2 · Deep dive */}
        <div id="sk-sec-2" className="scroll-mt-24">
          <div ref={scopeRowRef} className="mb-3.5 flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold-ink)] font-(family-name:--font-archivo)">
              {skuLevelLabel(attributeBase, level)} Deep Dive
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
                Kembali ke seluruh {skuLevelLabel(attributeBase, level).toLowerCase()}
              </button>
            )}
            <span className="text-[13px] text-[var(--ov-faint)]">
              mengikat count card, GMV trend, quadrant, dan tabel SKU di bawah
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
              <CountCard
                label="Count SKU"
                value={products ? formatIdr(products.countSku) : "…"}
                note="SKU dengan transaksi pada cakupan ini"
                active={countFilter === "all"}
                onClickAction={() => setCountFilter("all")}
              />
              <CountCard
                label="SKU di 2 Marketplace"
                value={products ? formatIdr(products.countCrossMarketplace) : "…"}
                note="terjual di Shopee dan TikTok pada periode ini"
                color="var(--ov-green-ink)"
                active={countFilter === "cross"}
                onClickAction={() => setCountFilter("cross")}
              />
              <CountCard
                label="Shopee Saja"
                value={products ? formatIdr(products.countShopeeOnly) : "…"}
                note="belum jalan di TikTok — peluang dibuka"
                color={SP_COLOR}
                active={countFilter === "shopee"}
                onClickAction={() => setCountFilter("shopee")}
              />
              <CountCard
                label="TikTok Saja"
                value={products ? formatIdr(products.countTiktokOnly) : "…"}
                note="belum jalan di Shopee — peluang dibuka"
                color={TT_COLOR}
                active={countFilter === "tiktok"}
                onClickAction={() => setCountFilter("tiktok")}
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
                height={260}
                gmvSplit={[
                  { key: "shopee", label: "Shopee", color: SP_COLOR },
                  { key: "tiktok", label: "TikTok", color: TT_COLOR },
                ]}
                headerExtra={<span className="text-[13px] text-[var(--ov-faint)]">granularitas {trendGranularity}</span>}
              />
            </div>
          </div>
        </div>

        {/* 2b · Quadrant */}
        <div
          id="sk-sec-2b"
          className="scroll-mt-24 rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">SKU Quadrant</span>
            <span className="text-[13px] text-[var(--ov-faint)]">(klik titik emas untuk membuka SKU-nya di deep dive)</span>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <ToggleChip
                active={excludeOutliers}
                onClickAction={() => filters.setExcludeOutliers(!excludeOutliers)}
                label="Kecualikan outlier dari skala"
              />
              <Select value={quadrant} onValueChange={(v) => v && filters.setQuadrant(v as SkuQuadrantPreset)}>
                <SelectTrigger className="h-8 w-80 bg-[var(--input)] text-sm">
                  <SelectValue>{(v: string) => SKU_QUADRANT_PRESETS[v as SkuQuadrantPreset]?.name ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SKU_QUADRANT_PRESETS) as SkuQuadrantPreset[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SKU_QUADRANT_PRESETS[k].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuadrantInfo spec={SKU_QUADRANT_PRESETS[quadrant]} excludeOutliers={excludeOutliers} />
              {quadrantSelection.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuadrantSelection([])}
                  className="rounded-full border border-[var(--ov-line)] px-3 py-1.5 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
                >
                  Lepas {quadrantSelection.length} SKU terpilih
                </button>
              )}
            </div>
          </div>
          {products ? (
            <ProductQuadrant
              rows={quadrantRows}
              spec={SKU_QUADRANT_PRESETS[quadrant]}
              excludeOutliers={excludeOutliers}
              selectedPids={quadrantSelection}
              onSelectManyAction={(barcodes) => {
                setQuadrantSelection(barcodes)
                // The detail endpoint takes the ids in the query string, so a huge lasso
                // narrows the table but only opens a readable slice in the deep dive.
                setSelectedBarcodes(barcodes.slice(0, DEEP_DIVE_LIMIT))
                setLastSection("quadrant")
              }}
              onSelectAction={(barcode) => setSelectedBarcodes([barcode])}
            />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 3 · SKU */}
        <SectionHeading id="sk-sec-3" step="2 · SKU" note={`cakupan: ${scopeLabel}`} />

        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-3.5">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="min-w-[260px] flex-1 text-lg font-semibold font-(family-name:--font-archivo)">
              Which SKUs Perform Differently Between Shopee and TikTok?
            </span>
            <Input
              value={search}
              onChange={(e) => filters.setSearch(e.target.value)}
              placeholder="Cari nama SKU atau barcode"
              className="h-8 w-56 bg-[var(--input)] text-sm"
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5 text-xs text-[var(--ov-faint)]">
            <span>
              {visibleSkus.length} SKU ditampilkan
              {products ? ` dari ${products.countSku} pada cakupan ini` : ""}
            </span>
            <span className="ml-auto">
              klik baris untuk deep dive · shift-klik untuk rentang · ⌘/ctrl-klik untuk tambah satu
            </span>
          </div>
          {products ? (
            <SkuProductTable
              rows={visibleSkus}
              selectedBarcodes={selectedBarcodes}
              onSelectAction={(barcode) => {
                setSelectedBarcodes([barcode])
                setLastSection("sku")
              }}
              onToggleAction={(barcode) => {
                toggleSelectedBarcode(barcode)
                setLastSection("sku")
              }}
              onSetSelectionAction={setSelectedBarcodes}
              showSplit={showSplit}
              showDetail={showDetailCols}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 4 · SKU deep dive + creators */}
        <div id="sk-sec-4" className="grid scroll-mt-24 grid-cols-1 gap-4.5 xl:grid-cols-2">
          <div className="flex flex-col">
            <div className="mb-3.5 flex min-h-[42px] flex-wrap items-center gap-3">
              <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold-ink)] font-(family-name:--font-archivo)">
                SKU Deep Dive
              </div>
              <span className="text-[13px] text-[var(--ov-faint)]">mengikuti baris SKU yang dipilih di tabel atas</span>
            </div>
            {detailUrl && detail?.key === detailUrl ? (
              <SkuDetailCard detail={detail.data} onRemoveAction={toggleSelectedBarcode} />
            ) : (
              <div
                className="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--ov-line)] px-6 text-center text-sm text-[var(--ov-faint)]"
                style={{ background: "var(--ov-card-gradient)" }}
              >
                {selectedKey
                  ? "Memuat detail SKU…"
                  : droppedPicks > 0
                    ? `${droppedPicks} SKU yang tadi dipilih tidak punya penjualan pada brand/periode ini, jadi pilihannya dilepas. Klik baris SKU lain untuk melihat detailnya.`
                    : "Klik satu baris SKU untuk melihat detailnya, atau centang beberapa baris untuk menggabungkannya."}
              </div>
            )}
          </div>

          {/* The creators column takes the deep-dive column's height instead of setting its own:
              on xl it is pulled out of flow (absolute) so the left card alone sizes the row, and
              the table scrolls inside. The min height keeps it usable before a product is picked. */}
          <div className="flex flex-col xl:relative xl:min-h-[820px]">
            <div className="flex flex-col xl:absolute xl:inset-0">
            <div className="mb-3.5 flex min-h-[42px] flex-wrap items-center gap-3.5">
              <div className="flex items-center gap-2.5">
                <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
                <span className="text-[17px] font-semibold font-(family-name:--font-archivo)">
                  Who are the Top Creators Across Marketplaces?
                </span>
                {/* Same as the PID pages: says what the list covers — the picked SKUs, or else the
                    level scope clicked in the category table (the whole level when none is). */}
                <span className="rounded-full border border-[var(--ov-line)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--ov-soft)]">
                  {selectedKey ? `${selectedBarcodes.length} SKU terpilih` : scopeLabel}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2.5">
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
                    <SkuTopCreatorsTable rows={creators.rows} onSelectAction={setOpenCreator} />
                  </div>
                  <div className="mt-3 border-t border-[var(--ov-line)] pt-2.5 text-xs leading-relaxed text-[var(--ov-faint)]">
                    10 creator teratas menyumbang {formatPercent(creators.concentrationTop10)} dari total GMV{" "}
                    {formatIdr(creators.totalGmv)} pada {selectedKey ? "SKU terpilih" : `cakupan ${scopeLabel}`}.
                  </div>
                </>
              ) : (
                <div className="flex h-[240px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
              )}
            </div>
            {/* Right under the top creators, not at the page bottom: these are the ones to act on,
                so they share the column and split its height rather than scroll out of view.
                Until something is picked the panel has nothing to show but a hint, so it shrinks
                to that and the creators table keeps the height. */}
            <div className={`mt-3.5 flex min-h-0 flex-col overflow-auto ${selectedKey ? "xl:flex-1" : "xl:flex-none"}`}>
              <OpportunityCreators
                endpoint="/api/sku/opportunity-creators"
                idParam="barcode"
                ids={selectedKey}
                onLoadedAction={(ids, data) => setOpportunity({ ids, data })}
                query={{ brand: csv(brand), from, to, attributeBase, ...modeParams, ...detailParams }}
              />
            </div>
            </div>
          </div>
        </div>


        <div className="text-xs leading-relaxed text-[var(--ov-faint)]">
          Catatan data: satu SKU dikenali lewat <span className="font-mono">BARCODE</span>, dan nama yang tampil adalah{" "}
          <span className="font-mono">VARIANT_SAP_NAME</span> terbaru per barcode — bukan nama sembarang, sehingga
          barcode yang produknya sempat berganti nama tetap jadi satu baris. Hal yang sama berlaku untuk nama listing di
          halaman Shopee PID dan TikTok PID. Kolom atribut marketplace{" "}
          <span className="font-mono">(SP_ dan TT_)</span> tidak dipakai di halaman ini: grain-nya PID, dan satu PID bisa
          memuat banyak barcode, jadi angkanya tidak bisa dibagi ke masing-masing SKU. Semua perbandingan di sini
          memakai kolom order yang tersedia sama di dua marketplace. Mode{" "}
          <span className="font-semibold text-[var(--ov-soft)]">Bundle dipecah</span> mengikuti logika dashboard yang
          sudah ada — True membaca komponen bundle, False membaca listing apa adanya, dan keduanya populasi berbeda
          sehingga totalnya memang tidak sama.
        </div>
      </div>

      <CreatorDetailModal
        grain="sku"
        endpoint="/api/sku/creator-detail"
        username={openCreator}
        query={{ brand: csv(brand), from, to, granularity: trendGranularity, ...modeParams, ...detailParams }}
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
  /** The card doubles as the SKU table's filter, the way the reference mockup uses it. */
  active: boolean
  onClickAction: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      title="Klik untuk menyaring tabel SKU di bawah"
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
            menyaring
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
export default function SkuPage() {
  return (
    <Suspense fallback={null}>
      <SkuPageInner />
    </Suspense>
  )
}
