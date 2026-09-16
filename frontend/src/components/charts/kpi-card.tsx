"use client"

import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { formatSignedPercent } from "@/lib/format"
import type { SummaryTrendPoint } from "@/types/overview"

export function KpiCard({
  label,
  value,
  deltaPct,
  compareLabel,
  sparkline,
  sparklineKey,
  positiveIsGood = true,
}: {
  label: string
  value: string
  deltaPct: number | null
  compareLabel: string
  sparkline: SummaryTrendPoint[]
  sparklineKey: keyof Omit<SummaryTrendPoint, "bucket">
  positiveIsGood?: boolean
}) {
  const isGood = deltaPct === null ? null : positiveIsGood ? deltaPct >= 0 : deltaPct <= 0
  const deltaColor = isGood === null ? "var(--ov-faint)" : isGood ? "var(--ov-green-ink)" : "var(--ov-red-ink)"

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="text-sm font-semibold text-[var(--ov-mut)]">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight font-(family-name:--font-archivo)">{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: deltaColor }}>
        {formatSignedPercent(deltaPct)} <span className="font-normal text-[var(--ov-faint)]">{compareLabel}</span>
      </div>
      <div className="-mx-1 mt-auto pt-2">
        <ResponsiveContainer width="100%" height={56}>
          <AreaChart data={sparkline}>
            <Area
              type="monotone"
              dataKey={sparklineKey}
              stroke="var(--ov-blue)"
              fill="var(--ov-blue)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
