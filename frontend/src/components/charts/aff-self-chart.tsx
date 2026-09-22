"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import type { SummaryTrendPoint } from "@/types/overview"
import { formatPercent, formatRpFull } from "@/lib/format"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

type Point = {
  label: string
  /** null on buckets whose affiliate rows have not loaded yet, which leaves a gap in the chart. */
  affiliate: number | null
  selfOperated: number | null
  total: number
}

/**
 * The series hold rupiah (the chart stacks them to 100% with stackOffset="expand"), so the
 * tooltip shows each amount with its share of that day's total — not the raw value as a percent.
 */
function AffSelfTooltip({
  active,
  payload,
  pendingNote,
}: {
  active?: boolean
  payload?: Array<{ payload?: Point }>
  pendingNote: string
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  if (p.affiliate === null || p.selfOperated === null) {
    return (
      <div
        className="max-w-[280px] rounded-lg border px-3 py-2 text-[12.5px]"
        style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
      >
        <div className="mb-1 font-semibold text-[var(--ov-head)]">{p.label}</div>
        <div className="text-[var(--ov-soft)]">Data affiliate belum masuk{pendingNote}, jadi porsinya belum dihitung.</div>
        <div className="mt-1 border-t border-[var(--ov-line)] pt-1 text-[var(--ov-faint)]">Total {formatRpFull(p.total)}</div>
      </div>
    )
  }
  const line = (label: string, value: number, color: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span style={{ color }}>{label}</span>
      <span className="font-mono text-[var(--ov-ink)]">
        {formatRpFull(value)}{" "}
        <span className="text-[var(--ov-faint)]">({p.total > 0 ? formatPercent(value / p.total) : "—"})</span>
      </span>
    </div>
  )
  return (
    <div
      className="min-w-[260px] rounded-lg border px-3 py-2 text-[12.5px]"
      style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
    >
      <div className="mb-1 font-semibold text-[var(--ov-head)]">{p.label}</div>
      {line("Affiliate", p.affiliate, "var(--ov-gold-ink)")}
      {line("Self Operated", p.selfOperated, "var(--ov-blue)")}
      <div className="mt-1 border-t border-[var(--ov-line)] pt-1 text-[var(--ov-faint)]">
        Total {formatRpFull(p.total)}
      </div>
    </div>
  )
}

export function AffSelfChart({
  trend,
  affiliateThrough = {},
}: {
  trend: SummaryTrendPoint[]
  /** Marketplace → last day with affiliate rows loaded; named in the gap's tooltip. */
  affiliateThrough?: Record<string, string>
}) {
  const data: Point[] = trend.map((t) => ({
    label: t.bucket,
    affiliate: t.affiliateShare === null ? null : t.gmv,
    selfOperated: t.affiliateShare === null ? null : Math.max(t.totalGmv - t.gmv, 0),
    total: t.totalGmv,
  }))
  const pending = Object.entries(affiliateThrough)
    .map(([m, d]) => `${m === "Tiktok" ? "TikTok" : m} baru s/d ${d}`)
    .join(", ")

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: "var(--ov-faint)", fontSize: 12 }} axisLine={{ stroke: "var(--ov-line)" }} tickLine={false} />
        <Tooltip {...TOOLTIP_PLACEMENT} content={<AffSelfTooltip pendingNote={pending ? ` (${pending})` : ""} />} />
        <Area type="monotone" dataKey="affiliate" stackId="1" stroke="var(--ov-gold)" fill="var(--ov-gold)" fillOpacity={0.55} name="Affiliate" />
        <Area type="monotone" dataKey="selfOperated" stackId="1" stroke="var(--ov-blue)" fill="var(--ov-blue)" fillOpacity={0.35} name="Self Operated" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
