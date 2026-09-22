"use client"

import { MetricTrend } from "@/components/charts/metric-trend"
import { CommentsPanel } from "@/components/comments-panel"
import { formatIdr, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import type { SkuDetail } from "@/types/sku"
import { Num } from "@/components/num"

const SP_COLOR = "var(--ov-gold)"
const TT_COLOR = "var(--ov-blue)"

export function SkuDetailCard({
  detail,
  onRemoveAction,
}: {
  detail: SkuDetail
  /** Drops one SKU from a combined selection. */
  onRemoveAction?: (barcode: string) => void
}) {
  const t = detail.totals
  const combined = detail.members.length > 1

  /** Each metric shown once per marketplace so the comparison is the default reading. */
  const paired = [
    { label: "GMV", sp: formatRpFull(t.shopee.gmv), tt: formatRpFull(t.tiktok.gmv) },
    { label: "Items Sold", sp: formatIdr(t.shopee.itemsSold), tt: formatIdr(t.tiktok.itemsSold) },
    { label: "Orders", sp: formatIdr(t.shopee.orders), tt: formatIdr(t.tiktok.orders) },
    { label: "Creators", sp: formatIdr(t.shopee.creators), tt: formatIdr(t.tiktok.creators) },
    { label: "Commission", sp: formatRpFull(t.shopee.commission), tt: formatRpFull(t.tiktok.commission) },
  ]

  return (
    <div
      className="flex flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient-soft)" }}
    >
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="flex h-[92px] w-[92px] flex-none flex-col items-center justify-center rounded-lg border border-dashed border-[var(--ov-line)] bg-[var(--ov-fill1)] text-center text-[11.5px] leading-tight text-[var(--ov-faint)]">
          {combined ? (
            <>
              <span className="text-xl font-bold text-[var(--ov-soft)] font-(family-name:--font-archivo)">
                {detail.members.length}
              </span>
              SKU
              <br />
              digabung
            </>
          ) : (
            <>
              Foto produk
              <br />
              (menyusul)
            </>
          )}
        </div>
        <div className="min-w-[210px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--ov-faint)]">
              {combined ? `${detail.barcodes.length} barcode` : detail.barcodes[0]}
            </span>
            <span className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-0.5 text-[12px] font-bold tracking-wide text-[var(--accent-foreground)] uppercase">
              {detail.category}
            </span>
            <span className="rounded border border-[var(--ov-line)] px-2 py-0.5 text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
              {detail.format}
            </span>
            {detail.isPaket && (
              <span className="rounded bg-[var(--ov-gold)]/20 px-2 py-0.5 text-[12px] font-bold tracking-wide text-[var(--ov-gold-ink)] uppercase">
                paket
              </span>
            )}
          </div>
          <div className="mt-2 text-[13.5px] leading-relaxed font-semibold">{detail.name}</div>
          <div className="mt-1 text-[12.5px] text-[var(--ov-faint)]">Sub category: {detail.subCategory}</div>
        </div>
      </div>

      {combined && (
        <div className="mt-3 max-h-[132px] overflow-y-auto rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] p-2">
          {detail.members.map((m) => (
            <div key={m.barcode} className="flex items-baseline gap-2 px-1 py-1 text-[12.5px]">
              <span className="font-mono text-[var(--ov-faint)]">{m.barcode}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--ov-soft)]" title={m.name}>
                {m.name}
              </span>
              <span className="font-mono text-[var(--ov-mut)]"><Num value={m.gmv} /></span>
              {onRemoveAction && (
                <button
                  type="button"
                  onClick={() => onRemoveAction(m.barcode)}
                  title="Keluarkan dari gabungan"
                  className="text-sm leading-none text-[var(--ov-faint)] hover:text-[var(--ov-ink)]"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* One set of boxes that also drives the chart: GMV, creators, AOV and the rest, each clickable. */}
      <div className="mt-3.5 border-t border-[var(--ov-line)] pt-3.5">
        <MetricTrend
          data={detail.trend}
          title="Metrik & trend"
          picker="cards"
          height={210}
          creatorsTotal={t.creators}
          cardNotes={{
            gmv: (
              <span style={{ color: (t.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}>
                {formatSignedPercent(t.growth)} vs pembanding
              </span>
            ),
            creators: "unik lintas marketplace",
            aov: "GMV ÷ orders",
          }}
          gmvSplit={[
            { key: "shopee", label: "Shopee", color: SP_COLOR },
            { key: "tiktok", label: "TikTok", color: TT_COLOR },
          ]}
        />
      </div>

      {/* The split bar is the headline of this page: one SKU, two marketplaces. */}
      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[var(--ov-mut)]">Komposisi marketplace</span>
          <span className="ml-auto font-mono text-[13px] font-semibold">
            {t.shopeeShare !== null ? `${formatPercent(t.shopeeShare, 1)} Shopee` : "—"}
          </span>
        </div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[var(--ov-track)]">
          <span style={{ width: `${(t.shopeeShare ?? 0) * 100}%`, background: SP_COLOR }} />
          <span style={{ width: `${(1 - (t.shopeeShare ?? 0)) * 100}%`, background: TT_COLOR }} />
        </div>
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-[12px] tracking-wide text-[var(--ov-faint)] uppercase">
              <th className="pb-1 text-left font-bold">Metrik</th>
              <th className="pb-1 text-right font-bold" style={{ color: SP_COLOR }}>
                Shopee
              </th>
              <th className="pb-1 text-right font-bold" style={{ color: TT_COLOR }}>
                TikTok
              </th>
            </tr>
          </thead>
          <tbody>
            {paired.map((m) => (
              <tr key={m.label}>
                <td className="border-t border-[var(--ov-line)] py-1.5 text-[var(--ov-soft)]">{m.label}</td>
                <td className="border-t border-[var(--ov-line)] py-1.5 text-right font-mono">{m.sp}</td>
                <td className="border-t border-[var(--ov-line)] py-1.5 text-right font-mono">{m.tt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="text-sm font-semibold text-[var(--ov-mut)]">Listing yang menjual SKU ini</div>
        <div className="mt-0.5 mb-2.5 text-[12.5px] text-[var(--ov-faint)]">
          Satu SKU biasanya dijual lewat banyak PID sekaligus — ini kontribusi masing-masing.
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {detail.pids.map((p) => (
            <div key={`${p.marketplace}-${p.pid}`} className="mb-2">
              <div className="flex items-baseline gap-2 text-[12.5px]">
                <span
                  className="rounded px-1.5 py-px text-[10.5px] font-bold tracking-wide uppercase"
                  style={{
                    background: p.marketplace === "Shopee" ? SP_COLOR : TT_COLOR,
                    color: "var(--ov-logo-ink, #10203c)",
                  }}
                >
                  {p.marketplace === "Shopee" ? "SP" : "TT"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--ov-soft)]" title={p.productName}>
                  {p.productName || p.pid}
                </span>
                <span className="font-mono font-semibold">{formatPercent(p.share, 1)}</span>
                <span className="w-20 text-right font-mono text-[var(--ov-faint)]"><Num value={p.gmv} /></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--ov-track)]">
                <span
                  className="block h-full"
                  style={{
                    width: `${p.share * 100}%`,
                    background: p.marketplace === "Shopee" ? SP_COLOR : TT_COLOR,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Comments hang off a single product; a merged selection has no one thing to discuss. */}
      {!(detail.barcodes.length > 1) && (
        <CommentsPanel
          barcode={detail.barcodes[0]}
        />
      )}
    </div>
  )
}
