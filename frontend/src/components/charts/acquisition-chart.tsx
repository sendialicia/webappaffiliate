"use client"

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCompact, formatIdr, formatSignedPercent } from "@/lib/format"
import type { AcquisitionPoint } from "@/types/overview"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

/**
 * What moved GMV in a bucket, against the bucket before it. GMV ≡ creators × GMV per creator,
 * so the log of each ratio splits the GMV move exactly; the larger share names the lever.
 */
export type Regime = "quantity" | "quality" | "dilution" | "fewer" | "weaker"

export const REGIMES: Record<Regime, { label: string; color: string; rule: string }> = {
  quantity: {
    label: "Didorong kuantitas",
    color: "var(--ov-blue)",
    rule: "GMV naik, dan sebagian besar kenaikannya dari jumlah creator yang bertambah.",
  },
  quality: {
    label: "Didorong kualitas",
    color: "var(--ov-green)",
    rule: "GMV naik, dan sebagian besar kenaikannya dari GMV per creator yang naik.",
  },
  dilution: {
    label: "Dilusi produktivitas",
    color: "var(--ov-gold)",
    rule: "Creator bertambah tapi GMV tidak ikut naik — creator baru belum perform.",
  },
  fewer: {
    label: "Creator berkurang",
    color: "var(--ov-red)",
    rule: "GMV turun, terutama karena creator yang menjual berkurang.",
  },
  weaker: {
    label: "Produktivitas turun",
    color: "#c084fc",
    rule: "GMV turun, terutama karena GMV per creator yang turun.",
  },
}

export function classify(p: AcquisitionPoint): Regime | null {
  const g = p.growth
  const c = p.creatorsGrowth
  const q = p.gmvPerCreatorGrowth
  if (g === null || c === null || q === null) return null
  const lnCreators = Math.log(1 + c)
  const lnProductivity = Math.log(1 + q)
  const creatorsLead = Math.abs(lnCreators) >= Math.abs(lnProductivity)
  if (g > 0) return creatorsLead ? "quantity" : "quality"
  if (c > 0) return "dilution"
  return creatorsLead ? "fewer" : "weaker"
}

type Row = AcquisitionPoint & { growthPct: number | null; creatorsGrowthPct: number | null; regime: Regime | null }

function AcquisitionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Row }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const regime = p.regime ? REGIMES[p.regime] : null
  const line = (label: string, value: string, change: number | null) => (
    <div className="grid grid-cols-[108px_1fr_auto] items-baseline gap-2 py-0.5">
      <span className="text-[var(--ov-faint)]">{label}</span>
      <span className="font-mono text-[var(--ov-ink)]">{value}</span>
      <span
        className="font-mono font-semibold"
        style={{ color: change === null ? "var(--ov-faint)" : change >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
      >
        {formatSignedPercent(change)}
      </span>
    </div>
  )
  return (
    <div
      className="w-[330px] rounded-lg border px-3 py-2.5 text-[12.5px]"
      style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-[var(--ov-head)]">{p.bucket}</span>
        {regime && (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--ov-soft)" }}>
            <i className="block h-2 w-2 rounded-full" style={{ background: regime.color }} />
            {regime.label}
          </span>
        )}
      </div>
      {line("GMV", `Rp${formatCompact(p.gmv)}`, p.growth)}
      {line("Creators", formatIdr(p.creators), p.creatorsGrowth)}
      {line("GMV / creator", p.gmvPerCreator !== null ? `Rp${formatIdr(p.gmvPerCreator)}` : "—", p.gmvPerCreatorGrowth)}
      <div className="mt-1 text-[12px] text-[var(--ov-faint)]">
        {formatIdr(p.newCreators)} creator baru (tidak aktif di periode pembanding) · % vs bucket sebelumnya
      </div>
      {regime && <div className="mt-1.5 border-t border-[var(--ov-line)] pt-1.5 text-[12px] text-[var(--ov-soft)]">{regime.rule}</div>}
    </div>
  )
}

/**
 * "Is GMV growth driven by creator quality or quantity?" Bars are GMV per creator (productivity),
 * the lines are GMV growth and creator-count growth against the previous bucket, and each bar is
 * tinted by which lever moved GMV that bucket.
 */
export function AcquisitionChart({ data, height = 300 }: { data: AcquisitionPoint[]; height?: number }) {
  const rows: Row[] = data.map((p) => ({
    ...p,
    growthPct: p.growth === null ? null : p.growth * 100,
    creatorsGrowthPct: p.creatorsGrowth === null ? null : p.creatorsGrowth * 100,
    regime: classify(p),
  }))
  const counts = rows.reduce<Partial<Record<Regime, number>>>((acc, r) => {
    if (r.regime) acc[r.regime] = (acc[r.regime] ?? 0) + 1
    return acc
  }, {})
  const classified = rows.filter((r) => r.regime).length

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ov-mut2)]">
        <span className="flex items-center gap-1.5">
          <i className="block h-2.5 w-2.5 rounded-sm bg-[var(--ov-track)]" /> GMV per creator (batang, kiri)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-0.5 w-3.5 rounded bg-[var(--ov-gold)]" /> Growth GMV
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-0.5 w-3.5 rounded bg-[var(--ov-blue)]" /> Growth jumlah creator
        </span>
        <span className="text-[var(--ov-faint)]">% vs bucket sebelumnya (kanan)</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--ov-line)" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis
            yAxisId="gpc"
            tickFormatter={(v) => `Rp${formatCompact(Number(v))}`}
            tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
            tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ReferenceLine yAxisId="pct" y={0} stroke="var(--ov-rule)" />
          <Tooltip {...TOOLTIP_PLACEMENT} cursor={{ fill: "var(--ov-fill1)" }} content={<AcquisitionTooltip />} />
          <Bar yAxisId="gpc" dataKey="gmvPerCreator" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell
                key={r.bucket}
                fill={r.regime ? REGIMES[r.regime].color : "var(--ov-track)"}
                fillOpacity={r.regime ? 0.32 : 1}
              />
            ))}
          </Bar>
          <Line yAxisId="pct" dataKey="growthPct" stroke="var(--ov-gold)" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="pct" dataKey="creatorsGrowthPct" stroke="var(--ov-blue)" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Rule-based readout: counts per regime, with each rule on hover. */}
      {classified > 0 && (
        <div className="mt-2.5 border-t border-[var(--ov-line)] pt-2 text-[12.5px] text-[var(--ov-soft)]">
          <span className="text-[var(--ov-faint)]">Dari {classified} bucket:</span>
          <span className="ml-1 inline-flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(REGIMES) as Regime[])
              .filter((k) => counts[k])
              .map((k) => (
                <span key={k} className="inline-flex cursor-help items-center gap-1.5" title={REGIMES[k].rule}>
                  <i className="block h-2 w-2 rounded-full" style={{ background: REGIMES[k].color }} />
                  <span className="font-semibold">{counts[k]}</span> {REGIMES[k].label.toLowerCase()}
                </span>
              ))}
          </span>
        </div>
      )}
    </div>
  )
}
