"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import type { SummaryTrendPoint } from "@/types/overview"
import { formatPercent } from "@/lib/format"

export function AffSelfChart({ trend }: { trend: SummaryTrendPoint[] }) {
  const data = trend.map((t) => {
    const total = t.affiliateShare > 0 ? t.gmv / t.affiliateShare : t.gmv
    return {
      label: t.bucket,
      affiliate: t.gmv,
      selfOperated: Math.max(total - t.gmv, 0),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: "var(--ov-faint)", fontSize: 11 }} axisLine={{ stroke: "var(--ov-line)" }} tickLine={false} />
        <Tooltip
          formatter={(value, name) => [formatPercent(Number(value)), String(name)]}
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
        />
        <Area type="monotone" dataKey="affiliate" stackId="1" stroke="var(--ov-gold)" fill="var(--ov-gold)" fillOpacity={0.55} name="Affiliate" />
        <Area type="monotone" dataKey="selfOperated" stackId="1" stroke="var(--ov-blue)" fill="var(--ov-blue)" fillOpacity={0.35} name="Self Operated" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
