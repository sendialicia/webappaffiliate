"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCompact, formatNumber } from "@/lib/format"
import type { AcquisitionPoint } from "@/types/overview"

export function AcquisitionChart({ data, height = 332 }: { data: AcquisitionPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--ov-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          yAxisId="gmv"
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <YAxis
          yAxisId="creators"
          orientation="right"
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [
            name === "Creator Acquisition" ? formatNumber(Number(value)) : formatCompact(Number(value)),
            String(name),
          ]}
        />
        <Bar yAxisId="gmv" dataKey="gmv" name="GMV" fill="#3c5a7e" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="creators"
          dataKey="newCreators"
          name="Creator Acquisition"
          stroke="var(--ov-gold)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
