"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CategoryTable } from "@/components/shopee-pid/category-table"
import { ProductTable } from "@/components/shopee-pid/product-table"
import { ProductDetail } from "@/components/shopee-pid/product-detail"
import { TopCreatorsTable } from "@/components/shopee-pid/top-creators-table"
import { ProductQuadrant, QUADRANT_PRESETS, QuadrantLegendInfo } from "@/components/charts/product-quadrant"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { apiFetch } from "@/lib/api"
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/date-range"
import { formatCompact, formatIdr, formatPercent } from "@/lib/format"
import { pidFiltersToParams, useShopeePidFilters } from "@/store/shopee-pid-filters"
import type {
  PidCategoriesResult,
  PidCreatorsResult,
  PidLevel,
  PidProductDetail,
  PidProductsResult,
  PidTrendPoint,
  QuadrantPreset,
} from "@/types/shopee-pid"

const LEVEL_LABELS: Record<PidLevel, string> = {
  category: "Category",
  subcategory: "Sub Category",
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

export default function ShopeePidPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useRef(false)

  const filters = useShopeePidFilters()
  const {
    brand,
    preset,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    selectedPid,
    quadrant,
    excludeOutliers,
    search,
    creatorPillar,
    creatorManaged,
    hydrateFromParams,
    setScope,
    setSelectedPid,
  } = filters

  const [categories, setCategories] = useState<PidCategoriesResult | null>(null)
  const [products, setProducts] = useState<PidProductsResult | null>(null)
  const [trend, setTrend] = useState<PidTrendPoint[] | null>(null)
  const [detail, setDetail] = useState<PidProductDetail | null>(null)
  const [creators, setCreators] = useState<PidCreatorsResult | null>(null)
  const [showPillars, setShowPillars] = useState(true)
  const [showShopee, setShowShopee] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hydrateFromParams(searchParams)
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    router.replace(`${pathname}?${pidFiltersToParams(filters).toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand,
    from,
    to,
    compare,
    trendGranularity,
    level,
    scope,
    selectedPid,
    quadrant,
    excludeOutliers,
    search,
    creatorPillar,
    creatorManaged,
  ])

  const scopeQuery = { brand: brand ?? undefined, from, to, compare, level, scope: scope ?? undefined }

  useEffect(() => {
    apiFetch<PidCategoriesResult>(
      `/api/shopee-pid/categories${buildQuery({ brand: brand ?? undefined, from, to, compare, level })}`,
    )
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat kategori"))
  }, [brand, from, to, compare, level])

  useEffect(() => {
    apiFetch<PidProductsResult>(`/api/shopee-pid/products${buildQuery(scopeQuery)}`)
      .then(setProducts)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat produk"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, compare, level, scope])

  useEffect(() => {
    apiFetch<PidTrendPoint[]>(
      `/api/shopee-pid/trend${buildQuery({ ...scopeQuery, granularity: trendGranularity })}`,
    )
      .then(setTrend)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat trend"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, level, scope, trendGranularity])

  useEffect(() => {
    if (!selectedPid) return
    apiFetch<PidProductDetail>(
      `/api/shopee-pid/product-detail${buildQuery({
        pid: selectedPid,
        brand: brand ?? undefined,
        from,
        to,
        compare,
        granularity: trendGranularity,
      })}`,
    )
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat detail produk"))
  }, [selectedPid, brand, from, to, compare, trendGranularity])

  useEffect(() => {
    apiFetch<PidCreatorsResult>(
      `/api/shopee-pid/top-creators${buildQuery({
        ...scopeQuery,
        pillar: creatorPillar ?? undefined,
        managed: creatorManaged === null ? undefined : String(creatorManaged),
        limit: "25",
      })}`,
    )
      .then(setCreators)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat creator"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, from, to, level, scope, creatorPillar, creatorManaged])

  const visibleProducts = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    return products.rows
      .filter((r) => r.inScope)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.pid.toLowerCase().includes(q))
  }, [products, search])

  const scopeLabel = scope ?? "Seluruh kategori"

  return (
    <DashboardShell
      title="Product — Shopee PID"
      subtitle="Kategori dan produk mana yang menggerakkan GMV Shopee."
      active="shopee-pid"
    >
      {/* Filter bar */}
      <div className="mx-6 mt-4 flex flex-wrap items-end gap-4 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] p-3.5 md:mx-8">
        <div className="min-w-[180px] flex-1">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Brand Name</div>
          <Select value={brand ?? "__all__"} onValueChange={(v) => v && filters.setBrand(v === "__all__" ? null : v)}>
            <SelectTrigger className="h-8.5 w-full bg-[var(--input)] text-sm">
              <SelectValue>{(v: string) => (v === "__all__" || !v ? "(All)" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">(All)</SelectItem>
              {BRAND_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Level</div>
          <Select value={level} onValueChange={(v) => v && filters.setLevel(v as PidLevel)}>
            <SelectTrigger className="h-8.5 w-40 bg-[var(--input)] text-sm">
              <SelectValue>{(v: string) => LEVEL_LABELS[v as PidLevel] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="subcategory">Sub Category</SelectItem>
              <SelectItem value="format">Format</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Tren Date</div>
          <Select
            value={trendGranularity}
            onValueChange={(v) => v && filters.setTrendGranularity(v as "day" | "week" | "month")}
          >
            <SelectTrigger className="h-8.5 w-28 bg-[var(--input)] text-sm">
              <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-none">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">Periode</div>
          <div className="flex gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
            {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => filters.setPreset(p)}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  background: preset === p ? "var(--ov-fill1)" : "transparent",
                  color: preset === p ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {DATE_PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" && (
          <div className="flex flex-none items-end gap-2">
            <Input type="date" value={from} onChange={(e) => filters.setCustomRange(e.target.value, to)} className="h-8.5 bg-[var(--input)] text-sm" />
            <Input type="date" value={to} onChange={(e) => filters.setCustomRange(from, e.target.value)} className="h-8.5 bg-[var(--input)] text-sm" />
          </div>
        )}

        <div className="ml-auto flex flex-none items-center gap-2.5">
          <span className="text-xs font-bold tracking-wider text-[var(--ov-faint)] uppercase">Bandingkan</span>
          <div className="flex gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
            {(["prev", "ly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => filters.setCompare(c)}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
                style={{
                  background: compare === c ? "var(--ov-fill1)" : "transparent",
                  color: compare === c ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {c === "prev" ? "vs prev" : "vs LY"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-4 py-3 text-sm text-[var(--ov-red)] md:mx-8">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
        {/* 1 · Category */}
        <SectionHeading step="1 · Category" />

        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-card-gradient)" }}
        >
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
            <span className="text-lg font-semibold font-(family-name:--font-archivo)">
              Which {LEVEL_LABELS[level]} is Driving Our Shopee GMV Growth?
            </span>
            <div className="ml-auto flex items-center gap-2">
              <ToggleChip active={showPillars} onClickAction={() => setShowPillars((v) => !v)} label="Kolom pillar" />
              <ToggleChip active={showShopee} onClickAction={() => setShowShopee((v) => !v)} label="Kolom Shopee" />
            </div>
          </div>
          <div className="mb-3 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
            Klik baris untuk mengikat seluruh seksi di bawah ke cakupan itu · growth, Δ Rp dan share dihitung{" "}
            {compare === "ly" ? "vs LY" : "vs periode sebelumnya"} · kolom Shopee (SP) memakai angka{" "}
            <span className="font-semibold text-[var(--ov-soft)]">confirmed</span>.
          </div>
          {categories ? (
            <CategoryTable
              total={categories.total}
              rows={categories.rows}
              scope={scope}
              onScopeAction={setScope}
              showPillars={showPillars}
              showShopee={showShopee}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 2 · Deep dive */}
        <div>
          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold)] font-(family-name:--font-archivo)">
              {LEVEL_LABELS[level]} Deep Dive
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent-foreground)]">
              {scopeLabel}
            </span>
            {scope && (
              <button
                type="button"
                onClick={() => setScope(null)}
                className="rounded-full border border-[var(--ov-line)] px-3 py-1.5 text-xs font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
              >
                Kembali ke seluruh {LEVEL_LABELS[level].toLowerCase()}
              </button>
            )}
            <span className="text-[12.5px] text-[var(--ov-faint)]">
              mengikat count card, GMV trend, quadrant, dan tabel produk di bawah
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
              <CountCard
                label="Count Product"
                value={products ? formatIdr(products.countProduct) : "…"}
                note="produk dengan transaksi pada cakupan ini"
              />
              <CountCard
                label="Count Profit Product"
                value={products ? formatIdr(products.countProfitProduct) : "…"}
                note="produk dengan GMV di atas nol"
                color="var(--ov-green)"
              />
            </div>
            <div
              className="rounded-xl border border-[var(--ov-line)] p-4 lg:col-span-2"
              style={{ background: "var(--ov-card-gradient)" }}
            >
              <div className="flex flex-wrap items-baseline gap-2.5">
                <div className="flex-1 text-sm font-semibold text-[var(--ov-mut)]">GMV Trend · {scopeLabel}</div>
                <div className="text-[11.5px] text-[var(--ov-faint)]">granularitas {trendGranularity}</div>
              </div>
              {trend ? (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--ov-line)" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis
                      tickFormatter={(v) => formatCompact(Number(v))}
                      tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <RTooltip
                      contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--ov-head)" }}
                      formatter={(value, name) => [formatIdr(Number(value)), name === "gmv" ? "GMV affiliate" : "SP GMV"]}
                    />
                    <Area type="monotone" dataKey="gmv" stroke="var(--ov-gold)" fill="var(--ov-gold)" fillOpacity={0.22} strokeWidth={2} />
                    <Area type="monotone" dataKey="spGmv" stroke="var(--ov-blue)" fill="var(--ov-blue)" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[230px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
              )}
            </div>
          </div>
        </div>

        {/* 2b · Quadrant */}
        <div
          className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
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
                label="Kecualikan outlier"
              />
              <Select value={quadrant} onValueChange={(v) => v && filters.setQuadrant(v as QuadrantPreset)}>
                <SelectTrigger className="h-8 w-60 bg-[var(--input)] text-sm">
                  <SelectValue>
                    {(v: string) => QUADRANT_PRESETS[v as QuadrantPreset]?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(QUADRANT_PRESETS) as QuadrantPreset[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {QUADRANT_PRESETS[k].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mb-2.5">
            <QuadrantLegendInfo preset={quadrant} />
          </div>
          {products ? (
            <ProductQuadrant
              rows={products.rows}
              preset={quadrant}
              excludeOutliers={excludeOutliers}
              onSelectAction={setSelectedPid}
            />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 3 · Product */}
        <SectionHeading step="2 · Product" note={`cakupan: ${scopeLabel}`} />

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
            <span className="ml-auto">klik satu baris untuk membuka deep dive · tabel bisa di-scroll</span>
          </div>
          {products ? (
            <ProductTable
              rows={visibleProducts}
              selectedPid={selectedPid}
              onSelectAction={setSelectedPid}
              showPillars={showPillars}
              showShopee={showShopee}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
          )}
        </div>

        {/* 4 · Product deep dive + creators */}
        <div className="grid grid-cols-1 gap-4.5 xl:grid-cols-2">
          <div className="flex flex-col">
            <div className="mb-3.5 flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 px-4 py-2 text-base font-semibold text-[var(--ov-gold)] font-(family-name:--font-archivo)">
                Product Deep Dive
              </div>
              <span className="text-[12.5px] text-[var(--ov-faint)]">mengikuti baris produk yang dipilih di tabel atas</span>
            </div>
            {selectedPid && detail && detail.pid === selectedPid ? (
              <ProductDetail detail={detail} />
            ) : (
              <div
                className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-[var(--ov-line)] px-6 text-center text-sm text-[var(--ov-faint)]"
                style={{ background: "var(--ov-card-gradient)" }}
              >
                {selectedPid
                  ? "Memuat detail produk…"
                  : "Pilih satu produk di tabel atau klik titik emas di quadrant untuk melihat detailnya."}
              </div>
            )}
          </div>

          <div
            className="flex flex-col rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
              <div className="flex items-center gap-2.5">
                <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
                <span className="text-[17px] font-semibold font-(family-name:--font-archivo)">
                  Who are the Top Creators by Pillars?
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
                  onValueChange={(v) =>
                    v && filters.setCreatorManaged(v === "__all__" ? null : v === "true")
                  }
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
              </div>
            </div>
            {creators ? (
              <>
                <TopCreatorsTable rows={creators.rows} />
                <div className="mt-3 border-t border-[var(--ov-line)] pt-2.5 text-xs leading-relaxed text-[var(--ov-faint)]">
                  10 creator teratas menyumbang {formatPercent(creators.concentrationTop10)} dari total GMV{" "}
                  {formatIdr(creators.totalGmv)} pada cakupan ini.
                </div>
              </>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
            )}
          </div>
        </div>
      </div>
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

function SectionHeading({ step, note }: { step: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
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
}: {
  label: string
  value: string
  note: string
  color?: string
}) {
  return (
    <div
      className="rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="text-[13px] leading-snug font-semibold text-[var(--ov-mut)]">{label}</div>
      <div
        className="mt-2 text-3xl font-bold tracking-tight font-(family-name:--font-archivo)"
        style={{ color: color ?? "var(--ov-ink)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[var(--ov-faint)]">{note}</div>
    </div>
  )
}
