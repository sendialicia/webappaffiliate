"use client"

import {
  Bar,
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

export function GmvCommissionChart({ trend, height = 126 }: { trend: SummaryTrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [formatCompact(Number(value)), String(name)]}
        />
        <Bar dataKey="gmv" name="GMV" fill="var(--ov-gold)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="commission" name="Commission" fill="var(--ov-blue)" radius={[2, 2, 0, 0]} />
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
        <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          domain={[0, axisMax]}
          allowDataOverflow
          tickFormatter={(v) => `${Math.round(Number(v))}x`}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value) => [`${Number(value).toFixed(1)}x`, "ROI"]}
        />
        <ReferenceLine
          y={ROI_THRESHOLD}
          stroke="var(--accent-foreground)"
          strokeDasharray="4 4"
          label={{ value: `${ROI_THRESHOLD.toFixed(1)}x`, fill: "var(--ov-faint)", fontSize: 10, position: "right" }}
        />
        <Line dataKey="roi" name="ROI" stroke="var(--ov-green)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
