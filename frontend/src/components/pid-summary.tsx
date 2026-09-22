"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatCompact, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import { ProductPhoto } from "@/components/product-photo"
import type { CreatorLeader, CreatorLeadersResult, ProductImage } from "@/types/shopee-pid"

/** The fields the podium reads; both PID pages' product rows carry them. */
export interface SummaryProduct {
  pid: string
  name: string
  gmv: number
  gmvPrev: number
  growth: number | null
  share: number
}

/** Past this, a percentage stops meaning anything to a reader: the base was close to nothing. */
const GROWTH_CAP = 9.99

function growthText(growth: number | null): string {
  if (growth === null) return "baru"
  if (growth > GROWTH_CAP) return ">+999%"
  return formatSignedPercent(growth)
}

function growthColor(growth: number | null): string {
  if (growth === null) return "var(--ov-blue)"
  return growth >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
}

/** Says what the growth figure compares, so ">+999%" and "baru" explain themselves on hover. */
function growthTitle(gmv: number, gmvPrev: number, growth: number | null): string {
  if (growth === null) return `Belum ada GMV di periode pembanding · sekarang ${formatRpFull(gmv)}`
  return `${formatRpFull(gmvPrev)} → ${formatRpFull(gmv)}`
}

const MEDALS = ["#f2c14e", "#c9d1dc", "#d49a6a"]
const MEDAL_INK = "#1b2a44"

/** Podium order on wide screens: runner-up left, winner centre, third right. */
const PODIUM_ORDER = [1, 0, 2]
const STEP_HEIGHT = [72, 50, 34]

function GrowthChip({ gmv, gmvPrev, growth }: { gmv: number; gmvPrev: number; growth: number | null }) {
  return (
    <span
      title={growthTitle(gmv, gmvPrev, growth)}
      className="cursor-help font-mono font-semibold"
      style={{ color: growthColor(growth) }}
    >
      {growthText(growth)}
    </span>
  )
}

/** The product itself, standing on its step: no card, just the photo and the numbers. */
function PodiumProduct({
  product,
  rank,
  image,
  onSelectAction,
}: {
  product: SummaryProduct
  rank: number
  image: ProductImage | null
  onSelectAction: (pid: string) => void
}) {
  const first = rank === 0
  return (
    <button
      type="button"
      onClick={() => onSelectAction(product.pid)}
      title={`${product.name}\nKlik untuk membuka di Product Deep Dive`}
      className="group flex w-full min-w-0 flex-col items-center px-1 text-center"
    >
      <span className="relative transition-transform group-hover:-translate-y-1">
        <ProductPhoto
          image={image}
          alt={product.name}
          size={first ? 112 : 88}
          className="shadow-[0_14px_28px_-16px_rgba(0,0,0,.6)]"
        />
        <span
          className="absolute -top-2.5 -left-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold shadow"
          style={{ background: MEDALS[rank], color: MEDAL_INK }}
        >
          {rank + 1}
        </span>
      </span>
      <span className="mt-2.5 line-clamp-2 max-w-[260px] text-[12.5px] leading-snug text-[var(--ov-soft)] group-hover:text-[var(--ov-ink)]">
        {product.name}
      </span>
      <span
        className="mt-1 font-bold tracking-tight font-(family-name:--font-archivo)"
        style={{ fontSize: first ? 26 : 20, color: first ? "var(--ov-gold-ink)" : "var(--ov-ink)" }}
        title={formatRpFull(product.gmv)}
      >
        Rp{formatCompact(product.gmv)}
      </span>
      <span className="flex flex-wrap items-center justify-center gap-x-1.5 text-[12.5px] text-[var(--ov-faint)]">
        <GrowthChip gmv={product.gmv} gmvPrev={product.gmvPrev} growth={product.growth} />
        <span>· share {formatPercent(product.share)}</span>
      </span>
    </button>
  )
}

function PodiumStep({ rank }: { rank: number }) {
  return (
    <div
      aria-hidden="true"
      className="mt-3 flex w-full items-center justify-center rounded-t-lg text-xl font-bold font-(family-name:--font-archivo)"
      style={{
        height: STEP_HEIGHT[rank],
        background:
          rank === 0
            ? "linear-gradient(180deg, color-mix(in srgb, var(--ov-gold) 70%, transparent), color-mix(in srgb, var(--ov-gold) 30%, transparent))"
            : "linear-gradient(180deg, color-mix(in srgb, var(--ov-gold) 34%, transparent), color-mix(in srgb, var(--ov-gold) 12%, transparent))",
        color: "var(--ov-gold-ink)",
      }}
    >
      {rank + 1}
    </div>
  )
}

function CreatorRow({
  creator,
  rank,
  onSelectAction,
}: {
  creator: CreatorLeader
  rank: number
  onSelectAction: (username: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectAction(creator.username)}
      title={`${creator.username} · share ${formatPercent(creator.share)} dari GMV affiliate produk ini\nKlik untuk melihat detail creator`}
      className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--ov-fill1)]"
    >
      <span className="w-3 flex-none text-center font-mono text-[11.5px] text-[var(--ov-faint)]">{rank + 1}</span>
      <span
        aria-hidden="true"
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold uppercase"
        style={{ background: "var(--ov-track)", color: "var(--ov-soft)" }}
      >
        {creator.username.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--ov-ink)]">
        {creator.username}
        {creator.isManaged && (
          <span className="ml-1.5 rounded bg-[var(--accent)] px-1 py-px align-middle text-[9.5px] font-bold tracking-wide text-[var(--accent-foreground)] uppercase">
            managed
          </span>
        )}
      </span>
      <span className="flex-none font-mono text-[var(--ov-soft)]" title={formatRpFull(creator.gmv)}>
        Rp{formatCompact(creator.gmv)}
      </span>
      <span className="w-[58px] flex-none text-right text-[12px]">
        <GrowthChip gmv={creator.gmv} gmvPrev={creator.gmvPrev} growth={creator.growth} />
      </span>
    </button>
  )
}

/** A product's own top creators, listed under its step. */
function ProductCreators({
  leaders,
  onSelectAction,
}: {
  leaders: CreatorLeadersResult | undefined
  onSelectAction: (username: string) => void
}) {
  return (
    <div className="w-full">
      <div className="mb-1 px-1.5 text-[11.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
        Top creator produk ini
      </div>
      {!leaders ? (
        <div className="px-1.5 py-3 text-[12.5px] text-[var(--ov-faint)]">Memuat…</div>
      ) : leaders.rows.length === 0 ? (
        <div className="px-1.5 py-3 text-[12.5px] text-[var(--ov-faint)]">Belum ada creator dengan penjualan.</div>
      ) : (
        <div className="flex flex-col">
          {leaders.rows.map((c, i) => (
            <CreatorRow key={c.username} creator={c} rank={i} onSelectAction={onSelectAction} />
          ))}
        </div>
      )}
      {leaders?.agency && (
        <div
          className="mt-1 px-1.5 text-[11.5px] leading-relaxed text-[var(--ov-faint)]"
          title="TikTok mencatat penjualan agency di satu username gabungan, jadi tidak dimasukkan ke peringkat"
        >
          + Agency (agregat) {formatPercent(leaders.agency.share)} · Rp{formatCompact(leaders.agency.gmv)}
        </div>
      )}
    </div>
  )
}

/**
 * The page's opening summary: the three biggest products on a podium, each with its own top
 * creators underneath, all with growth against the comparison window. Follows the filter bar
 * (brand, period, comparison, detail filters), not the category scope below it. Clicking a
 * product opens its deep dive; clicking a creator opens their pop-up.
 */
export function PidSummary({
  marketplace,
  products,
  leadersUrl,
  contextLabel,
  onSelectProductAction,
  onSelectCreatorAction,
}: {
  marketplace: "shopee" | "tiktok"
  /** Every product in the selection, largest GMV first (the products endpoint's order). */
  products: SummaryProduct[] | null
  /** The page's product-creator-leaders endpoint with its filters in the query; `pid` is added here. */
  leadersUrl: string
  /** e.g. "Kahf · 2026-09-01 → 2026-09-20", so the reader knows what the podium covers. */
  contextLabel: string
  onSelectProductAction: (pid: string) => void
  onSelectCreatorAction: (username: string) => void
}) {
  const [leaders, setLeaders] = useState<{ url: string; data: Record<string, CreatorLeadersResult> } | null>(null)
  const [images, setImages] = useState<Record<string, ProductImage | null>>({})

  const top = (products ?? []).filter((p) => p.gmv > 0).slice(0, 3)
  const topKey = top.map((p) => p.pid).join(",")
  const url = topKey ? `${leadersUrl}${leadersUrl.includes("?") ? "&" : "?"}pid=${encodeURIComponent(topKey)}` : null

  useEffect(() => {
    if (!url) return
    let stale = false
    apiFetch<Record<string, CreatorLeadersResult>>(url)
      .then((data) => {
        if (!stale) setLeaders({ url, data })
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [url])

  useEffect(() => {
    if (!topKey) return
    let stale = false
    apiFetch<Record<string, ProductImage | null>>(
      `/api/product-images?marketplace=${marketplace}&pids=${encodeURIComponent(topKey)}`,
    )
      .then((data) => {
        if (!stale) setImages((prev) => ({ ...prev, ...data }))
      })
      // Photos are decoration here: without them the podium still reads.
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [marketplace, topKey])

  const fresh = leaders && leaders.url === url ? leaders.data : null

  const header = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <i className="block h-2.5 w-2.5 flex-none self-center rounded-full" style={{ background: "var(--ov-gold)" }} />
      <span className="text-lg font-semibold font-(family-name:--font-archivo)">Top 3 Produk &amp; Creator-nya</span>
      <span className="text-[13px] text-[var(--ov-faint)]">{contextLabel} · growth vs periode pembanding</span>
    </div>
  )

  if (products === null) {
    return (
      <div>
        {header}
        <div className="flex h-[300px] items-center justify-center text-sm text-[var(--ov-faint)]">Loading…</div>
      </div>
    )
  }
  if (top.length === 0) {
    return (
      <div>
        {header}
        <div className="py-10 text-center text-sm text-[var(--ov-faint)]">Belum ada produk dengan penjualan di pilihan ini.</div>
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Wide screens: a real podium. Products and steps share one grid bottom-aligned, so the
          steps sit on one floor; the creator lists sit in a second grid right under it. */}
      <div className="mx-auto hidden max-w-[980px] md:block">
        <div className="mt-6 grid grid-cols-3 items-end gap-5">
          {PODIUM_ORDER.map((rank) => {
            const product = top[rank]
            // With fewer than three products the empty slot keeps the winner centred.
            if (!product) return <div key={rank} />
            return (
              <div key={product.pid} className="flex flex-col items-center">
                <PodiumProduct
                  product={product}
                  rank={rank}
                  image={images[product.pid] ?? null}
                  onSelectAction={onSelectProductAction}
                />
                <PodiumStep rank={rank} />
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-3 gap-5 border-t-2 border-[color-mix(in_srgb,var(--ov-gold)_40%,transparent)] pt-3">
          {PODIUM_ORDER.map((rank) => {
            const product = top[rank]
            if (!product) return <div key={rank} />
            return (
              <ProductCreators key={product.pid} leaders={fresh?.[product.pid]} onSelectAction={onSelectCreatorAction} />
            )
          })}
        </div>
      </div>

      {/* Narrow screens: rank order, each product followed by its own creators. */}
      <div className="mt-5 flex flex-col gap-6 md:hidden">
        {top.map((product, rank) => (
          <div key={product.pid} className="flex flex-col items-center gap-3">
            <PodiumProduct
              product={product}
              rank={rank}
              image={images[product.pid] ?? null}
              onSelectAction={onSelectProductAction}
            />
            <ProductCreators leaders={fresh?.[product.pid]} onSelectAction={onSelectCreatorAction} />
          </div>
        ))}
      </div>
    </div>
  )
}
