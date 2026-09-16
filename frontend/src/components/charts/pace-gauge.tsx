"use client"

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts"
import type { PaceSummary } from "@/types/overview"
import { formatPercent } from "@/lib/format"

export function PaceGauge({ pace }: { pace: PaceSummary }) {
  const pct = Math.min(pace.actualPct, 1) * 100
  const data = [{ name: "actual", value: pct }]

  return (
    <div className="relative" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height={180}>
        <RadialBarChart
          cx="50%"
          cy="82%"
          innerRadius="130%"
          outerRadius="200%"
          barSize={16}
          startAngle={180}
          endAngle={0}
          data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "var(--ov-track)" }} dataKey="value" fill="var(--ov-gold)" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
        <div className="text-2xl font-bold font-(family-name:--font-archivo)">{formatPercent(pace.actualPct, 0)}</div>
        <div className="text-xs text-[var(--ov-faint)]">of monthly target</div>
      </div>
    </div>
  )
}
