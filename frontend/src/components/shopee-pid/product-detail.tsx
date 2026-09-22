"use client"

import { MetricTrend } from "@/components/charts/metric-trend"
import { DIMENSION_COLORS } from "@/components/overview/composition-table"
import { GmvSplitHover } from "@/components/charts/gmv-split-hover"
import { LeverWaterfall } from "@/components/charts/lever-waterfall"
import { CommentsPanel } from "@/components/comments-panel"
import { formatIdr, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import type { PidProductDetail } from "@/types/shopee-pid"
import { Num } from "@/components/num"
import { VariantContribution } from "@/components/variant-contribution"

export function ProductDetail({
  detail,
  onRemoveAction,
}: {
  detail: PidProductDetail
  /** Drops one product from a combined selection. */
  onRemoveAction?: (pid: string) => void
}) {
  const a = detail.attributes
  const p = detail.attributesPrev
  const combined = detail.members.length > 1


  return (
    <div
      className="flex flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient-soft)" }}
    >
      <div>
        <div className="flex flex-wrap items-start gap-3.5">
          <div className="flex h-[92px] w-[92px] flex-none flex-col items-center justify-center rounded-lg border border-dashed border-[var(--ov-line)] bg-[var(--ov-fill1)] text-center text-[11.5px] leading-tight text-[var(--ov-faint)]">
            {combined ? (
              <>
                <span className="text-xl font-bold text-[var(--ov-soft)] font-(family-name:--font-archivo)">
                  {detail.members.length}
                </span>
                produk
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
                {combined ? `${detail.pids.length} PID` : `PID ${detail.pids[0]}`}
              </span>
              <span className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-0.5 text-[12px] font-bold tracking-wide text-[var(--accent-foreground)] uppercase">
                {detail.category}
              </span>
              <span className="rounded border border-[var(--ov-line)] px-2 py-0.5 text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
                {detail.format}
              </span>
            </div>
            <div className="mt-2 text-[13.5px] leading-relaxed font-semibold">{detail.name}</div>
            <div className="mt-1 text-[12.5px] text-[var(--ov-faint)]">Sub category: {detail.subCategory}</div>
          </div>
        </div>

        {combined && (
          <div className="mt-3 max-h-[132px] overflow-y-auto rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] p-2">
            {detail.members.map((m) => (
              <div key={m.pid} className="flex items-baseline gap-2 px-1 py-1 text-[12.5px]">
                <span className="font-mono text-[var(--ov-faint)]">{m.pid}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--ov-soft)]" title={m.name}>
                  {m.name}
                </span>
                <span className="font-mono text-[var(--ov-mut)]"><Num value={m.gmv} /></span>
                {onRemoveAction && (
                  <button
                    type="button"
                    onClick={() => onRemoveAction(m.pid)}
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

        {/* One set of boxes: the ones with a daily series toggle the chart below; marketplace-centre
            attributes sit alongside as info. Headline numbers are the internal order data (the
            same source as the trend); the centre's own figure is kept as a note where it differs. */}
        <div className="mt-3.5 border-t border-[var(--ov-line)] pt-3.5">
          <MetricTrend
            data={detail.trend}
            title="Metrik & trend"
            picker="cards"
            height={210}
            creatorsTotal={detail.creators}
            cardNotes={{
              gmv: (
                <span style={{ color: (detail.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}>
                  {formatSignedPercent(detail.growth)} vs pembanding
                </span>
              ),
              creators: "creator dengan penjualan",
              commission: (() => {
                const commission = detail.trend.reduce((acc, t) => acc + t.commission, 0)
                return commission > 0 ? `ROI ${(detail.gmv / commission).toFixed(1)}x` : "—"
              })(),
              aov: "GMV ÷ orders",
            }}
            cardHover={{
              gmv: (
                <GmvSplitHover
                  gmv={detail.gmv}
                  gmvPrev={detail.gmvPrev}
                  creators={detail.creators}
                  creatorsPrev={detail.creatorsPrev}
                  compareLabel="vs periode pembanding"
                />
              ),
            }}
            infoCards={[
              {
                label: "Clicks",
                value: formatIdr(a.spClicks),
                note: a.spCoRate !== null ? `CO rate (centre) ${formatPercent(a.spCoRate, 2)}` : "—",
              },
              {
                label: "Buyers",
                value: formatIdr(a.spBuyers),
                note: a.spBuyers > 0 ? `${formatPercent(a.spNewBuyers / a.spBuyers)} pembeli baru` : "—",
              },
            ]}
          />
        </div>
      </div>


      {/* Which variant carries this listing, before which pillar moved it. */}
      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <VariantContribution variants={detail.variants ?? []} />
      </div>

      {/* Which pillar moved the number, directly under the trend that raised the question. */}
      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="text-sm font-semibold text-[var(--ov-mut)]">Apa yang bikin GMV berubah?</div>
        <div className="mt-0.5 mb-2 text-[12.5px] text-[var(--ov-faint)]">
          Tiap tuas ditukar satu per satu dari nilai periode pembanding ke periode ini.
        </div>
        <LeverWaterfall
          gmvLabel="GMV affiliate"
          gmvPrev={detail.gmvPrev}
          gmv={detail.gmv}
          ordersPrev={detail.ordersPrev}
          orders={detail.orders}
          levers={[
            { name: "Clicks", prev: p.spClicks, now: a.spClicks, format: (v) => formatIdr(Math.round(v)) },
            {
              name: "CO rate",
              prev: p.spClicks > 0 ? detail.ordersPrev / p.spClicks : 0,
              now: a.spClicks > 0 ? detail.orders / a.spClicks : 0,
              format: (v) => formatPercent(v, 2),
            },
            {
              name: "AOV",
              prev: detail.ordersPrev > 0 ? detail.gmvPrev / detail.ordersPrev : 0,
              now: detail.orders > 0 ? detail.gmv / detail.orders : 0,
              format: (v) => formatRpFull(v),
            },
          ]}
        />
      </div>

      {/* Composition now, compressed to a single bar so it sits on one line under the trend. */}
      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-[var(--ov-mut)]">Komposisi pillar</span>
          <span className="text-[12.5px] text-[var(--ov-faint)]">share GMV produk ini sekarang</span>
        </div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[var(--ov-track)]">
          {detail.pillars.map((p, i) => (
            <span
              key={p.name}
              title={`${p.name} · ${formatPercent(p.share)} · ${formatIdr(p.gmv)}`}
              style={{
                width: `${p.share * 100}%`,
                background: DIMENSION_COLORS[i % DIMENSION_COLORS.length],
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {detail.pillars.map((p, i) => (
            <span key={p.name} className="flex items-center gap-1.5">
              <i
                className="block h-2.5 w-2.5 flex-none rounded-sm"
                style={{ background: DIMENSION_COLORS[i % DIMENSION_COLORS.length] }}
              />
              <span className="font-semibold text-[var(--ov-soft)]">{p.name}</span>
              <span className="font-mono text-[var(--ov-mut)]">{formatPercent(p.share)}</span>
              <span
                className="font-mono"
                style={{ color: (p.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
              >
                {formatSignedPercent(p.growth)}
              </span>
            </span>
          ))}
        </div>
      </div>
      {/* Comments hang off a single product; a merged selection has no one thing to discuss. */}
      {!(detail.pids.length > 1) && (
        <CommentsPanel
          productId={detail.pids[0]}
        marketplace="Shopee"
        />
      )}
    </div>
  )
}
