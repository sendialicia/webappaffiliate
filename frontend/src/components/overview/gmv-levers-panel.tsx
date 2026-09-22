"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { LeverWaterfall } from "@/components/charts/lever-waterfall"
import { decompose, type Lever } from "@/lib/lever-decompose"
import { formatCompact, formatDateLabel, formatIdr, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import type { BrandLevers, GmvLeversResult, LeverMarketplace, MarketplaceLevers } from "@/types/gmv-levers"

const MARKETPLACE_LABEL: Record<LeverMarketplace, string> = { Tiktok: "TikTok", Shopee: "Shopee" }
const MARKETPLACE_COLOR: Record<LeverMarketplace, string> = { Tiktok: "#4aa3e0", Shopee: "#f2c14e" }

const DETAIL_LABELS: Record<string, string> = {
  pillar: "Pillar",
  subpillar: "Sub Pillar",
  productCategory: "Product Category",
  productSubCategory: "Product Sub Category",
  productFormat: "Product Format",
}

const count = (v: number) => formatIdr(Math.round(v))
const rate = (v: number) => formatPercent(v, 2)

/**
 * The levers of one marketplace lane, every rate recomputed from that lane's totals (CLAUDE.md):
 *   TikTok  Impressions × CTR × CO rate × AOV
 *   Shopee  Clicks × CO rate × AOV
 * null when a lever's base is zero in either window: the identity would divide by zero, so the
 * lane cannot be split rather than being split wrongly.
 */
function leversOf(m: MarketplaceLevers): Lever[] | null {
  const c = m.current
  const p = m.previous
  if (c.orders <= 0 || p.orders <= 0 || c.clicks <= 0 || p.clicks <= 0) return null
  const tail: Lever[] = [
    { name: "CO rate", prev: p.orders / p.clicks, now: c.orders / c.clicks, format: rate },
    { name: "AOV", prev: p.gmv / p.orders, now: c.gmv / c.orders, format: (v) => `Rp${formatIdr(Math.round(v))}` },
  ]
  if (m.marketplace === "Shopee") {
    return [{ name: "Clicks", prev: p.clicks, now: c.clicks, format: count }, ...tail]
  }
  if (!c.impressions || !p.impressions) return null
  return [
    { name: "Impressions", prev: p.impressions, now: c.impressions, format: count },
    { name: "CTR", prev: p.clicks / p.impressions, now: c.clicks / c.impressions, format: rate },
    ...tail,
  ]
}

interface LeverMove {
  marketplace: LeverMarketplace
  name: string
  /** Rupiah this lever moved GMV by (chain substitution). */
  delta: number
  /** The lever's own change, e.g. CTR 2.6% → 2.3% is −11.5%. */
  change: number | null
}

function movesOf(m: MarketplaceLevers): LeverMove[] | null {
  const levers = leversOf(m)
  if (!levers) return null
  return decompose(levers).map((part, i) => {
    const lever = levers[i]!
    return {
      marketplace: m.marketplace,
      name: part.name,
      delta: part.delta,
      change: lever.prev > 0 ? lever.now / lever.prev - 1 : null,
    }
  })
}

const gmvOf = (lanes: MarketplaceLevers[], w: "current" | "previous") => lanes.reduce((a, m) => a + m[w].gmv, 0)

/**
 * One rule-based sentence per brand: the lever that moved its GMV most, in rupiah, and — when a
 * lever pushed the other way by at least a quarter as much — that one too, so "turun karena CTR
 * TikTok, walau impressions naik" is visible without reading the chart.
 */
function driverSentence(moves: LeverMove[], gmvDelta: number): string {
  if (moves.length === 0) return "Belum bisa diurai (data funnel pembanding kosong)."
  const byImpact = [...moves].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const main = byImpact[0]!
  const describe = (m: LeverMove) =>
    `${m.name} ${MARKETPLACE_LABEL[m.marketplace]} ${m.change === null ? "" : formatSignedPercent(m.change)}`.trim()
  const counter = byImpact.find(
    (m) => Math.sign(m.delta) !== Math.sign(main.delta) && Math.abs(m.delta) >= Math.abs(main.delta) * 0.25,
  )
  const direction = gmvDelta >= 0 ? "Naik" : "Turun"
  return `${direction} terutama karena ${describe(main)}${counter ? `, walau ${describe(counter)}` : ""}.`
}

function LeverChip({ move }: { move: LeverMove | undefined }) {
  if (!move) return <span className="text-[var(--ov-faint)]">—</span>
  return (
    <span
      title={`${move.name} ${MARKETPLACE_LABEL[move.marketplace]}: ${move.delta >= 0 ? "+" : "−"}${formatRpFull(Math.abs(move.delta))} ke GMV`}
      className="cursor-help font-mono text-[12px] font-semibold"
      style={{ color: move.delta >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
    >
      {move.change === null ? "—" : formatSignedPercent(move.change)}
    </span>
  )
}

const TIKTOK_LEVERS = ["Impressions", "CTR", "CO rate", "AOV"]
const SHOPEE_LEVERS = ["Clicks", "CO rate", "AOV"]

function BrandTable({
  brands,
  selected,
  onSelectAction,
}: {
  brands: BrandLevers[]
  selected: string | null
  onSelectAction: (brand: string | null) => void
}) {
  const rows = brands
    .map((b) => {
      const tiktok = b.marketplaces.find((m) => m.marketplace === "Tiktok")
      const shopee = b.marketplaces.find((m) => m.marketplace === "Shopee")
      const tiktokMoves = tiktok ? movesOf(tiktok) : null
      const shopeeMoves = shopee ? movesOf(shopee) : null
      const gmv = gmvOf(b.marketplaces, "current")
      const gmvPrev = gmvOf(b.marketplaces, "previous")
      return {
        brand: b.brand,
        gmv,
        delta: gmv - gmvPrev,
        growth: gmvPrev > 0 ? gmv / gmvPrev - 1 : null,
        tiktokMoves,
        shopeeMoves,
        sentence: driverSentence([...(tiktokMoves ?? []), ...(shopeeMoves ?? [])], gmv - gmvPrev),
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const head = "sticky top-0 z-[1] bg-[var(--card)] px-2 py-2 text-[11px] font-bold tracking-wide text-[var(--ov-head)] uppercase whitespace-nowrap"
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-[var(--ov-line)]">
      <table className="w-full min-w-[1080px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th rowSpan={2} className={`${head} text-left`}>Brand</th>
            <th rowSpan={2} className={`${head} text-right`}>GMV</th>
            <th rowSpan={2} className={`${head} text-right`}>Δ GMV</th>
            <th colSpan={4} className={`${head} text-center`} style={{ color: MARKETPLACE_COLOR.Tiktok }}>
              TikTok · perubahan tiap tuas
            </th>
            <th colSpan={3} className={`${head} text-center`} style={{ color: MARKETPLACE_COLOR.Shopee }}>
              Shopee · perubahan tiap tuas
            </th>
            <th rowSpan={2} className={`${head} text-left`}>Penggerak utama</th>
          </tr>
          <tr>
            {[...TIKTOK_LEVERS, ...SHOPEE_LEVERS].map((l, i) => (
              <th key={`${l}-${i}`} className={`${head} top-[33px] text-right font-semibold normal-case`}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const active = selected === r.brand
            return (
              <tr
                key={r.brand}
                onClick={() => onSelectAction(active ? null : r.brand)}
                title={active ? "Klik lagi untuk kembali ke semua brand" : "Klik untuk melihat waterfall brand ini di atas"}
                className="cursor-pointer border-t border-[var(--ov-fill1)] hover:bg-[var(--ov-fill1)]"
                style={{ background: active ? "var(--accent)" : undefined }}
              >
                <td className="px-2 py-2 font-semibold text-[var(--ov-ink)]">{r.brand}</td>
                <td className="px-2 py-2 text-right font-mono text-[var(--ov-soft)]" title={formatRpFull(r.gmv)}>
                  {formatCompact(r.gmv)}
                </td>
                <td
                  className="px-2 py-2 text-right font-mono whitespace-nowrap"
                  style={{ color: r.delta >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
                  title={`${r.delta >= 0 ? "+" : "−"}${formatRpFull(Math.abs(r.delta))}`}
                >
                  {r.growth === null ? "baru" : formatSignedPercent(r.growth)}
                </td>
                {TIKTOK_LEVERS.map((l) => (
                  <td key={`t-${l}`} className="px-2 py-2 text-right">
                    <LeverChip move={r.tiktokMoves?.find((m) => m.name === l)} />
                  </td>
                ))}
                {SHOPEE_LEVERS.map((l) => (
                  <td key={`s-${l}`} className="px-2 py-2 text-right">
                    <LeverChip move={r.shopeeMoves?.find((m) => m.name === l)} />
                  </td>
                ))}
                <td className="min-w-[260px] px-2 py-2 leading-snug text-[var(--ov-soft)]">{r.sentence}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Lane({ lane, label }: { lane: MarketplaceLevers | undefined; label: string }) {
  const name = lane ? MARKETPLACE_LABEL[lane.marketplace] : ""
  if (!lane) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--ov-line)] px-4 py-6 text-center text-[13px] text-[var(--ov-faint)]">
        Tidak ada penjualan affiliate {label} pada pilihan ini.
      </div>
    )
  }
  const levers = leversOf(lane)
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold font-(family-name:--font-archivo)">
        <i className="block h-2.5 w-2.5 rounded-full" style={{ background: MARKETPLACE_COLOR[lane.marketplace] }} />
        {name}
      </div>
      {lane.marketplace === "Shopee" && (
        <p className="mb-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
          Affiliate centre Shopee tidak menyediakan impressions, jadi jalurnya dimulai dari klik.
        </p>
      )}
      {levers ? (
        <LeverWaterfall
          levers={levers}
          gmvLabel={`GMV affiliate ${name}`}
          gmvPrev={lane.previous.gmv}
          gmv={lane.current.gmv}
          ordersPrev={lane.previous.orders}
          orders={lane.current.orders}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--ov-line)] px-4 py-6 text-center text-[13px] text-[var(--ov-faint)]">
          Data funnel {name} kosong di salah satu periode, jadi perubahannya belum bisa diurai.
        </div>
      )}
    </div>
  )
}

/**
 * "Kenapa GMV berubah?" — opened from the GMV Affiliate card. Two lanes, never merged: TikTok
 * has impressions and Shopee does not, and the two affiliate centres count clicks differently,
 * so a combined CTR or CO rate would describe nothing real. The brand table under them is the
 * per-brand answer; clicking a row redraws the two lanes for that brand.
 */
export function GmvLeversPanel({
  open,
  query,
  onCloseAction,
}: {
  open: boolean
  /** Same query string the summary uses (period, comparison, brand, marketplace, details). */
  query: string
  onCloseAction: () => void
}) {
  const [result, setResult] = useState<{ query: string; data?: GmvLeversResult; error?: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let stale = false
    apiFetch<GmvLeversResult>(`/api/overview/gmv-levers${query}`)
      .then((data) => {
        if (!stale) setResult({ query, data })
      })
      .catch((e) => {
        if (!stale) setResult({ query, error: e instanceof Error ? e.message : "Gagal memuat data" })
      })
    return () => {
      stale = true
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCloseAction])

  if (!open) return null
  const current = result?.query === query ? result : null
  const data = current?.data ?? null
  const brand = selected && data?.brands.find((b) => b.brand === selected) ? selected : null
  const lanes = brand ? data!.brands.find((b) => b.brand === brand)!.marketplaces : (data?.total ?? [])
  const gmv = gmvOf(lanes, "current")
  const gmvPrev = gmvOf(lanes, "previous")
  const cuts = data ? Object.entries(data.funnelThrough) : []

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Kenapa GMV berubah?"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseAction()
      }}
    >
      <div
        className="w-full max-w-[1180px] rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] duration-200 animate-in fade-in slide-in-from-bottom-2"
        style={{ background: "var(--ov-card-gradient)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[18px] font-semibold font-(family-name:--font-archivo)">Kenapa GMV berubah?</span>
          {brand && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-foreground)]"
              title="Kembali ke semua brand"
            >
              {brand} ✕
            </button>
          )}
          <button
            type="button"
            onClick={onCloseAction}
            aria-label="Tutup"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ov-line)] text-[var(--ov-faint)] hover:bg-[var(--ov-fill1)] hover:text-[var(--ov-ink)]"
          >
            ✕
          </button>
        </div>

        {current?.error && (
          <div className="mt-4 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-4 py-3 text-sm text-[var(--ov-red-ink)]">
            {current.error}
          </div>
        )}
        {!data && !current?.error && (
          <div className="flex h-[360px] items-center justify-center text-sm text-[var(--ov-faint)]">Memuat…</div>
        )}

        {data && (
          <>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ov-faint)]">
              {brand ?? "Brand terpilih"} · {data.current.from} → {data.current.to} vs {data.comparison.from} →{" "}
              {data.comparison.to}. GMV affiliate{" "}
              <span className="font-semibold text-[var(--ov-soft)]">
                {gmv - gmvPrev >= 0 ? "naik" : "turun"} Rp{formatIdr(Math.abs(Math.round(gmv - gmvPrev)))}
              </span>
              {lanes.length > 1 &&
                ` = ${lanes
                  .map(
                    (m) =>
                      `${MARKETPLACE_LABEL[m.marketplace]} ${m.current.gmv - m.previous.gmv >= 0 ? "+" : "−"}Rp${formatCompact(Math.abs(m.current.gmv - m.previous.gmv))}`,
                  )
                  .join(" + ")}`}
              . Semua rate dihitung ulang dari total, bukan rata-rata produk.
            </p>
            {(cuts.length > 0 || data.ignoredFilters.length > 0) && (
              <div className="mt-2 rounded-md border border-[var(--ov-gold)]/35 bg-[var(--ov-gold)]/10 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--ov-soft)]">
                {cuts.length > 0 && (
                  <div>
                    <span className="font-semibold">Data funnel:</span>{" "}
                    {cuts
                      .map(([m, d]) => `${MARKETPLACE_LABEL[m as LeverMarketplace]} baru tersedia s/d ${formatDateLabel(d!)}`)
                      .join(" · ")}
                    , jadi jalur itu (dan pembandingnya, di hari ke-sekian yang sama) dihitung sampai tanggal tersebut —
                    angka GMV di sini bisa sedikit beda dengan kartu GMV.
                  </div>
                )}
                {data.ignoredFilters.length > 0 && (
                  <div>
                    <span className="font-semibold">Filter tidak berlaku:</span>{" "}
                    {data.ignoredFilters.map((f) => DETAIL_LABELS[f] ?? f).join(", ")} — impressions dan klik adalah
                    angka per produk, jadi tidak bisa dipecah per pillar atau SKU.
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Lane lane={lanes.find((m) => m.marketplace === "Tiktok")} label="TikTok" />
              <Lane lane={lanes.find((m) => m.marketplace === "Shopee")} label="Shopee" />
            </div>

            <div className="mt-6 border-t border-[var(--ov-line)] pt-4">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[15px] font-semibold font-(family-name:--font-archivo)">Per brand</span>
                <span className="text-[12.5px] text-[var(--ov-faint)]">
                  persen = perubahan tuas itu sendiri · warna = arah pengaruhnya ke GMV (hover untuk rupiahnya) · klik
                  baris untuk melihat waterfall brand itu
                </span>
              </div>
              <BrandTable brands={data.brands} selected={brand} onSelectAction={setSelected} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
