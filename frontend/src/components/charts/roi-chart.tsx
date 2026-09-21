"use client"

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCompact } from "@/lib/format"
import type { SummaryTrendPoint } from "@/types/overview"

/** Business rule, confirmed with Sendi: ROI = GMV / Commission, floor at 12x. */
export const ROI_THRESHOLD = 12.0

/**
 * Indexed to 100 at the first bucket where both series have data. GMV runs ~28x
 * larger than commission, so a shared axis flattens commission into the baseline
 * and a second axis would put them on arbitrary scales. Indexing answers the
 * question the title actually asks: which one is growing faster.
 */
export function GmvCommissionChart({ trend, height = 150 }: { trend: SummaryTrendPoint[]; height?: number }) {
  const base = trend.find((t) => t.gmv > 0 && t.commission > 0)

  const data = trend.map((t) => ({
    bucket: t.bucket,
    gmvIndex: base && base.gmv > 0 ? (t.gmv / base.gmv) * 100 : null,
    // Commission lands a couple of days after GMV; a zero there is missing data,
    // not a collapse, so it renders as a gap.
    commissionIndex: base && base.commission > 0 && t.commission > 0 ? (t.commission / base.commission) * 100 : null,
    gmv: t.gmv,
    commission: t.commission,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          tickFormatter={(v) => `${Math.round(Number(v))}`}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name, item) => {
            const row = item?.payload as { gmv: number; commission: number } | undefined
            const actual = name === "GMV" ? row?.gmv : row?.commission
            const idx = value === null ? "—" : `${Number(value).toFixed(0)}`
            return [`${idx} (${formatCompact(Number(actual ?? 0))})`, String(name)]
          }}
        />
        <ReferenceLine y={100} stroke="var(--ov-rule)" strokeDasharray="4 4" />
        <Line dataKey="gmvIndex" name="GMV" stroke="var(--ov-gold)" strokeWidth={2} dot={false} connectNulls={false} />
        <Line
          dataKey="commissionIndex"
          name="Commission"
          stroke="var(--ov-blue)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/**
 * Partially-loaded buckets (commission still landing) produce huge ROI outliers that
 * flatten the rest of the series. Cap the axis at a robust upper bound and let those
 * points clip instead of rescaling everything around them.
 */
function roiAxisMax(trend: SummaryTrendPoint[]): number {
  const values = trend.map((t) => t.roi).filter((v): v is number => v !== null && Number.isFinite(v))
  if (values.length === 0) return ROI_THRESHOLD * 2

  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? ROI_THRESHOLD
  return Math.max(ROI_THRESHOLD * 1.5, Math.ceil(median * 2))
}

export function RoiChart({ trend, height = 118 }: { trend: SummaryTrendPoint[]; height?: number }) {
  const axisMax = roiAxisMax(trend)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          domain={[0, axisMax]}
          allowDataOverflow
          tickFormatter={(v) => `${Math.round(Number(v))}x`}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value) => [`${Number(value).toFixed(1)}x`, "ROI"]}
        />
        <ReferenceLine
          y={ROI_THRESHOLD}
          stroke="var(--accent-foreground)"
          strokeDasharray="4 4"
          label={{ value: `${ROI_THRESHOLD.toFixed(1)}x`, fill: "var(--ov-faint)", fontSize: 11.5, position: "right" }}
        />
        <Line dataKey="roi" name="ROI" stroke="var(--ov-green)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
