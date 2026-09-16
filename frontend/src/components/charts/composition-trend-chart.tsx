"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { DIMENSION_COLORS } from "@/components/overview/composition-table"
import { formatCompact } from "@/lib/format"
import type { CompositionTrendPoint } from "@/types/overview"

export function CompositionTrendChart({
  trend,
  names,
  highlighted,
  height = 300,
}: {
  trend: CompositionTrendPoint[]
  names: string[]
  highlighted: string | null
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={{ stroke: "var(--ov-line)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [formatCompact(Number(value)), String(name)]}
        />
        {names.map((name, i) => {
          const color = DIMENSION_COLORS[i % DIMENSION_COLORS.length]
          const dimmed = highlighted !== null && highlighted !== name
          return (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stackId="1"
              stroke={color}
              fill={color}
              fillOpacity={dimmed ? 0.08 : 0.5}
              strokeOpacity={dimmed ? 0.25 : 1}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}
