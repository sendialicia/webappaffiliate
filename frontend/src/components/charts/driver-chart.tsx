"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { DIMENSION_COLORS } from "@/components/overview/composition-table"
import { formatCompact } from "@/lib/format"
import type { DriverChartRow } from "@/types/overview"

export function DriverChart({
  rows,
  names,
  mode,
  height = 330,
}: {
  rows: DriverChartRow[]
  names: string[]
  mode: "stacked" | "grouped"
  height?: number
}) {
  const isPercent = mode === "grouped"

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => (isPercent ? `${Math.round(Number(v))}%` : formatCompact(Number(v)))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="entity"
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={78}
        />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [
            isPercent ? `${Number(value).toFixed(1)}%` : formatCompact(Number(value)),
            String(name),
          ]}
        />
        {isPercent && <ReferenceLine x={0} stroke="var(--ov-rule)" />}
        {names.map((name, i) => (
          <Bar
            key={name}
            dataKey={name}
            stackId={mode === "stacked" ? "s" : undefined}
            fill={DIMENSION_COLORS[i % DIMENSION_COLORS.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DriverLegend({ names }: { names: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 pt-10">
      {names.map((name, i) => (
        <span
          key={name}
          className="flex items-center gap-2 text-[11.5px] font-semibold whitespace-nowrap text-[var(--ov-soft)]"
        >
          <i
            className="block h-2.5 w-2.5 flex-none rounded-sm"
            style={{ background: DIMENSION_COLORS[i % DIMENSION_COLORS.length] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}
