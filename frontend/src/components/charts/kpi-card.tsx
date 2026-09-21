"use client"

import type { ReactNode } from "react"
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts"
import { formatSignedPercent } from "@/lib/format"
import type { SummaryTrendPoint } from "@/types/overview"

type TrendKey = keyof Omit<SummaryTrendPoint, "bucket">

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
}: {
  label: string
  value: string
  deltaPct: number | null
  compareLabel: string
  sparkline: SummaryTrendPoint[]
  sparklineKey: TrendKey
  positiveIsGood?: boolean
  color?: string
  note?: string
  deltaHover?: ReactNode
  size?: "sm" | "lg"
}) {
  const large = size === "lg"

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-[var(--ov-line)] p-4 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="text-sm font-semibold text-[var(--ov-mut)]">{label}</div>
      <div
        className={`mt-1 font-bold tracking-tight font-(family-name:--font-archivo) ${large ? "text-[32px] leading-tight" : "text-2xl"}`}
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
      <div className="-mx-1 mt-auto pt-2">
        <ResponsiveContainer width="100%" height={large ? 120 : 56}>
          <AreaChart data={sparkline}>
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
