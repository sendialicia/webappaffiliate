"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { DIMENSION_COLORS } from "@/components/overview/composition-table"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { PidProductDetail } from "@/types/shopee-pid"

export function ProductDetail({ detail }: { detail: PidProductDetail }) {
  const a = detail.attributes

  const kpis = [
    { label: "GMV affiliate", value: formatIdr(detail.gmv), note: formatSignedPercent(detail.growth) },
    { label: "Creators", value: formatIdr(detail.creators), note: "creator dengan penjualan" },
    { label: "SP GMV (confirmed)", value: formatIdr(a.spGmv), note: "dari Shopee affiliate centre" },
    { label: "Orders", value: formatIdr(a.spOrders), note: `${formatIdr(a.spProductSold)} unit terjual` },
    { label: "Clicks", value: formatIdr(a.spClicks), note: a.spCoRate !== null ? `CO rate ${formatPercent(a.spCoRate, 2)}` : "—" },
    {
      label: "Buyers",
      value: formatIdr(a.spBuyers),
      note: a.spBuyers > 0 ? `${formatPercent(a.spNewBuyers / a.spBuyers)} pembeli baru` : "—",
    },
    { label: "Est commission", value: formatIdr(a.spCommission), note: a.spRoi !== null ? `ROI ${a.spRoi.toFixed(1)}x` : "—" },
  ]

  return (
    <div
      className="flex flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient-soft)" }}
    >
      <div>
        <div className="flex flex-wrap items-start gap-3.5">
          <div className="flex h-[92px] w-[92px] flex-none items-center justify-center rounded-lg border border-dashed border-[var(--ov-line)] bg-[var(--ov-fill1)] text-center text-[10px] leading-tight text-[var(--ov-faint)]">
            Foto produk
            <br />
            (menyusul)
          </div>
          <div className="min-w-[210px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--ov-faint)]">
                PID {detail.pid}
              </span>
              <span className="rounded border border-[var(--accent)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[var(--accent-foreground)] uppercase">
                {detail.category}
              </span>
              <span className="rounded border border-[var(--ov-line)] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
                {detail.format}
              </span>
            </div>
            <div className="mt-2 text-[13.5px] leading-relaxed font-semibold">{detail.name}</div>
            <div className="mt-1 text-[11.5px] text-[var(--ov-faint)]">Sub category: {detail.subCategory}</div>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-[var(--ov-line)] pt-3.5 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label}>
              <div className="text-[10.5px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">{k.label}</div>
              <div className="mt-1 font-mono text-[14px] font-semibold">{k.value}</div>
              <div className="mt-0.5 text-[11px] text-[var(--ov-faint)]">{k.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="text-sm font-semibold text-[var(--ov-mut)]">GMV Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={detail.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--ov-line)" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis
              tickFormatter={(v) => formatCompact(Number(v))}
              tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--ov-head)" }}
              formatter={(value) => [formatIdr(Number(value)), "GMV"]}
            />
            <Area type="monotone" dataKey="gmv" stroke="var(--ov-gold)" fill="var(--ov-gold)" fillOpacity={0.25} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
        <div className="text-sm font-semibold text-[var(--ov-mut)]">Pillar Contribution</div>
        <div className="mt-0.5 mb-3 text-[11.5px] text-[var(--ov-faint)]">
          Share GMV produk ini per pillar, dengan pertumbuhan dan selisih rupiahnya.
        </div>
        {detail.pillars.map((p, i) => {
          const color = DIMENSION_COLORS[i % DIMENSION_COLORS.length]
          return (
            <div key={p.name} className="mb-3">
              <div className="flex items-baseline gap-2.5">
                <i className="block h-2.5 w-2.5 flex-none rounded-sm" style={{ background: color }} />
                <span className="flex-1 text-[13px] font-semibold text-[var(--ov-soft)]">{p.name}</span>
                <span className="font-mono text-[13px] font-semibold">{formatPercent(p.share)}</span>
                <span
                  className="min-w-[72px] text-right font-mono text-[12px] font-semibold"
                  style={{ color: (p.growth ?? 0) >= 0 ? "var(--ov-green)" : "var(--ov-red)" }}
                >
                  {formatSignedPercent(p.growth)}
                </span>
              </div>
              <div className="my-1.5 h-2 overflow-hidden rounded-full bg-[var(--ov-track)]">
                <span className="block h-full" style={{ width: `${p.share * 100}%`, background: color }} />
              </div>
              <div className="text-[11.5px] text-[var(--ov-faint)]">
                {formatIdr(p.gmv)} · {p.delta >= 0 ? "+" : "−"}
                {formatIdr(Math.abs(p.delta))} vs periode pembanding
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
