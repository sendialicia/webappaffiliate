"use client"

import type { ReactNode } from "react"
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"
import { formatIdr, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"
import type { SummaryTrendPoint } from "@/types/overview"

type TrendKey = keyof Omit<SummaryTrendPoint, "bucket">

/** How each sparkline metric reads in its tooltip — the same units the card's headline uses. */
const TREND_FORMAT: Record<TrendKey, (v: number) => string> = {
  gmv: formatRpFull,
  gmvPerCreator: formatRpFull,
  asp: formatRpFull,
  aov: formatRpFull,
  commission: formatRpFull,
  creators: formatIdr,
  itemsSold: formatIdr,
  affiliateShare: (v) => formatPercent(v, 2),
  commissionRate: (v) => formatPercent(v, 2),
  refundRate: (v) => formatPercent(v, 2),
  roi: (v) => `${v.toFixed(1)}x`,
}

/**
 * The commission-based ratios move with commission booking, which trails GMV by days, so their
 * tooltip also shows the two amounts behind the ratio: a spike reads as "no commission yet".
 */
const SHOWS_INPUTS = new Set<TrendKey>(["roi", "commissionRate"])

function SparkTooltip({
  active,
  payload,
  trendKey,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: SummaryTrendPoint }>
  trendKey: TrendKey
  label: string
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const value = point[trendKey]
  return (
    <div
      className="rounded-lg border px-2.5 py-1.5 text-[12px] whitespace-nowrap"
      style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
    >
      <div className="font-semibold text-[var(--ov-head)]">{point.bucket}</div>
      <div className="text-[var(--ov-soft)]">
        {label}:{" "}
        <span className="font-mono font-semibold text-[var(--ov-ink)]">
          {value === null || value === undefined ? "— (komisi hari ini belum lengkap)" : TREND_FORMAT[trendKey](value)}
        </span>
      </div>
      {SHOWS_INPUTS.has(trendKey) && (
        <div className="mt-0.5 font-mono text-[11.5px] text-[var(--ov-faint)]">
          GMV {formatRpFull(point.gmv)} · komisi {formatRpFull(point.commission)}
        </div>
      )}
    </div>
  )
}

interface DualMetric {
  label: string
  value: string
  deltaPct: number | null
  trendKey: TrendKey
  color: string
}

function deltaColor(deltaPct: number | null, positiveIsGood: boolean): string {
  if (deltaPct === null) return "var(--ov-faint)"
  const isGood = positiveIsGood ? deltaPct >= 0 : deltaPct <= 0
  return isGood ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
}

function DeltaLine({
  deltaPct,
  compareLabel,
  positiveIsGood,
}: {
  deltaPct: number | null
  compareLabel: string
  positiveIsGood: boolean
}) {
  return (
    <div className="mt-1 text-sm font-semibold" style={{ color: deltaColor(deltaPct, positiveIsGood) }}>
      {formatSignedPercent(deltaPct)} <span className="font-normal text-[var(--ov-faint)]">{compareLabel}</span>
    </div>
  )
}

/** The rupiah restatement of the delta, sitting under it inside the same hover target. */
function NoteLine({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 border-t border-[var(--ov-line)] pt-2 font-mono text-[12.5px] text-[var(--ov-faint)]">
      {children}
    </div>
  )
}

export function KpiCard({
  label,
  value,
  deltaPct,
  compareLabel,
  sparkline,
  sparklineKey,
  positiveIsGood = true,
  color = "var(--ov-blue)",
  note,
  /** Shown when the reader hovers the delta — for explaining where the change came from. */
  deltaHover,
  /** "lg" is the headline card: bigger number and a taller chart. */
  size = "sm",
  exact,
  onOpenAction,
  openLabel,
}: {
  label: string
  value: string
  /** The unabbreviated figure, shown on hover when `value` is short ("Rp148.2B"). */
  exact?: string
  deltaPct: number | null
  compareLabel: string
  sparkline: SummaryTrendPoint[]
  sparklineKey: TrendKey
  positiveIsGood?: boolean
  color?: string
  note?: string
  deltaHover?: ReactNode
  size?: "sm" | "lg"
  /** When set, the card offers a deeper panel behind a button (the hover stays as it is). */
  onOpenAction?: () => void
  openLabel?: string
}) {
  const large = size === "lg"

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="text-sm font-semibold text-[var(--ov-mut)]">{label}</div>
      <div
        className={`mt-1 font-bold tracking-tight font-(family-name:--font-archivo) ${large ? "text-[32px] leading-tight" : "text-2xl"} ${exact ? "cursor-help" : ""}`}
        title={exact}
      >
        {value}
      </div>
      {/* The percentage and the rupiah difference describe the same move, so when there is an
          explanation to show they act as one hover target — reaching for the rupiah figure is
          the more natural gesture, and it kept missing. The tooltip hangs below both. */}
      {deltaHover ? (
        <div className="group relative cursor-help">
          <div className="w-max border-b border-dotted border-[var(--ov-track)] pb-0.5">
            <DeltaLine deltaPct={deltaPct} compareLabel={compareLabel} positiveIsGood={positiveIsGood} />
          </div>
          {note && <NoteLine>{note}</NoteLine>}
          <div className="absolute top-full left-0 z-50 hidden pt-2 group-hover:block">{deltaHover}</div>
        </div>
      ) : (
        <>
          <DeltaLine deltaPct={deltaPct} compareLabel={compareLabel} positiveIsGood={positiveIsGood} />
          {note && <NoteLine>{note}</NoteLine>}
        </>
      )}
      {onOpenAction && (
        <button
          type="button"
          onClick={onOpenAction}
          className="mt-2.5 flex w-max items-center gap-1.5 rounded-full border border-[var(--ov-gold)]/60 bg-[var(--ov-gold)]/10 px-3 py-1 text-[12.5px] font-semibold text-[var(--ov-gold-ink)] hover:bg-[var(--ov-gold)]/20"
        >
          {openLabel ?? "Lihat detail"}
          <span aria-hidden="true">→</span>
        </button>
      )}
      <div className="-mx-1 mt-auto pt-2">
        <ResponsiveContainer width="100%" height={large ? 120 : 56}>
          <AreaChart data={sparkline}>
            <Tooltip
              {...TOOLTIP_PLACEMENT}
              cursor={{ stroke: "var(--ov-track)" }}
              content={<SparkTooltip trendKey={sparklineKey} label={label} />}
            />
            <Area
              type="monotone"
              dataKey={sparklineKey}
              stroke={color}
              fill={color}
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

/** Two related metrics in one card, each keeping its own line so neither trend is implied by the other. */
export function DualKpiCard({
  compareLabel,
  sparkline,
  metrics,
}: {
  compareLabel: string
  sparkline: SummaryTrendPoint[]
  metrics: [DualMetric, DualMetric]
}) {
  return (
    <div
      className="flex h-full flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      {/* One card, but each metric keeps its own axis — a shared axis would flatten whichever
          metric has the smaller range and imply a relationship that isn't there. */}
      <div className="grid h-full grid-cols-2 gap-x-4 divide-x divide-[var(--ov-line)]">
        {metrics.map((m, i) => (
          <div key={m.label} className={`flex flex-col ${i > 0 ? "pl-4" : ""}`}>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ov-mut)]">
              <i className="block h-2 w-2 flex-none rounded-full" style={{ background: m.color }} />
              {m.label}
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-(family-name:--font-archivo)">{m.value}</div>
            <DeltaLine deltaPct={m.deltaPct} compareLabel={compareLabel} positiveIsGood />
            <div className="-mx-1 mt-auto pt-2">
              <ResponsiveContainer width="100%" height={56}>
                <LineChart data={sparkline}>
                  <Tooltip
                    {...TOOLTIP_PLACEMENT}
                    cursor={{ stroke: "var(--ov-track)" }}
                    content={<SparkTooltip trendKey={m.trendKey} label={m.label} />}
                  />
                  <Line type="monotone" dataKey={m.trendKey} stroke={m.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
