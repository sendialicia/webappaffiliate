"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { MouseHandlerDataParam } from "recharts"
import { formatCompact } from "@/lib/format"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

export interface ComboPoint {
  key: string
  label: string
  actualGmv: number
  lyGmv: number
  target: number
}

export function PerformanceComboChart({
  data,
  height = 260,
  onPointClick,
}: {
  data: ComboPoint[]
  height?: number
  onPointClick?: (key: string) => void
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barGap={1}
        barCategoryGap="22%"
        onClick={(state: MouseHandlerDataParam) => {
          const index = Number(state.activeIndex)
          const point = Number.isFinite(index) ? data[index] : undefined
          if (point && onPointClick) onPointClick(point.key)
        }}
      >
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--ov-faint)", fontSize: 12 }}
          axisLine={{ stroke: "var(--ov-line)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip {...TOOLTIP_PLACEMENT}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [formatCompact(Number(value)), String(name)]}
          cursor={{ fill: "var(--ov-fill1)" }}
        />
        <Bar
          dataKey="lyGmv"
          name="LY GMV"
          fill="var(--ov-blue)"
          radius={[3, 3, 0, 0]}
          style={{ cursor: onPointClick ? "pointer" : undefined }}
        />
        <Bar
          dataKey="actualGmv"
          name="Actual GMV"
          fill="var(--ov-gold)"
          radius={[3, 3, 0, 0]}
          style={{ cursor: onPointClick ? "pointer" : undefined }}
        />
        <Line dataKey="target" name="Target" stroke="var(--ov-red)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
