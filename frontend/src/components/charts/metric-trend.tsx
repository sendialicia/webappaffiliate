"use client"

import { useState } from "react"
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { MultiSelect } from "@/components/multi-select"
import { formatCompact, formatIdr, formatRpFull } from "@/lib/format"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

export type TrendMetricKey = "gmv" | "itemsSold" | "orders" | "commission" | "creators" | "aov"

/** One bucket of the shared trend payload every PID/SKU trend endpoint returns. */
export interface TrendMetricPoint {
  bucket: string
  gmv: number
  itemsSold: number
  orders: number
  commission: number
  creators: number
  aov: number | null
}

export const TREND_METRICS: Record<TrendMetricKey, { label: string; kind: "money" | "count"; color: string }> = {
  gmv: { label: "GMV", kind: "money", color: "var(--ov-gold)" },
  itemsSold: { label: "Items Sold", kind: "count", color: "var(--ov-green)" },
  orders: { label: "Orders", kind: "count", color: "var(--ov-blue)" },
  commission: { label: "Commission", kind: "money", color: "var(--ov-red)" },
  creators: { label: "Creators", kind: "count", color: "#a78bfa" },
  aov: { label: "AOV", kind: "money", color: "#f59e0b" },
}

const METRIC_KEYS = Object.keys(TREND_METRICS) as TrendMetricKey[]

/** More than three lines on two axes stops being readable. */
export const MAX_TREND_METRICS = 3

function formatValue(key: TrendMetricKey, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return TREND_METRICS[key].kind === "money" ? formatRpFull(value) : formatIdr(value)
}

/**
 * Period totals for the metric cards. Additive metrics sum across buckets; AOV is recomputed
 * from those sums; creators cannot be summed (a creator active in two buckets would count
 * twice), so it only shows when the caller passes the true distinct count.
 */
function periodTotals(data: TrendMetricPoint[], creators?: number): Record<TrendMetricKey, number | null> {
  const sum = (k: "gmv" | "itemsSold" | "orders" | "commission") => data.reduce((acc, p) => acc + (p[k] || 0), 0)
  const gmv = sum("gmv")
  const orders = sum("orders")
  return {
    gmv,
    itemsSold: sum("itemsSold"),
    orders,
    commission: sum("commission"),
    creators: creators ?? null,
    aov: orders > 0 ? gmv / orders : null,
  }
}

export function MetricTrend({
  data,
  title,
  picker,
  height = 230,
  creatorsTotal,
  gmvSplit,
  headerExtra,
  cardNotes,
  cardHover,
  infoCards,
}: {
  data: TrendMetricPoint[] | null
  title: string
  /** "select": compact dropdown, for the category trend. "cards": clickable metric boxes, for a product's own trend. */
  picker: "select" | "cards"
  height?: number
  /** The period's distinct creator count, for the card; per-bucket counts cannot be summed into it. */
  creatorsTotal?: number
  /** With GMV alone selected, stack these per-bucket series instead of one line (SKU's marketplace split). */
  gmvSplit?: Array<{ key: string; label: string; color: string }>
  headerExtra?: React.ReactNode
  /** Line under a card's value (growth, the marketplace centre's own figure, …). */
  cardNotes?: Partial<Record<TrendMetricKey, React.ReactNode>>
  /** Popover shown while hovering a card, e.g. the GMV split. */
  cardHover?: Partial<Record<TrendMetricKey, React.ReactNode>>
  /**
   * Figures with no daily series (marketplace-centre attributes such as clicks), shown in the same
   * grid so the product has one set of boxes — but not clickable, since there is nothing to plot.
   */
  infoCards?: Array<{ label: string; value: string; note?: React.ReactNode }>
}) {
  const [metrics, setMetrics] = useState<TrendMetricKey[]>(["gmv"])

  const toggle = (key: TrendMetricKey) =>
    setMetrics((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((k) => k !== key) : current
      return current.length >= MAX_TREND_METRICS ? current : [...current, key]
    })

  const showSplit = gmvSplit !== undefined && metrics.length === 1 && metrics[0] === "gmv"
  const hasCount = metrics.some((k) => TREND_METRICS[k].kind === "count")
  const hasMoney = metrics.some((k) => TREND_METRICS[k].kind === "money")
  // Counts on the left and rupiah on the right, like the marketplace seller centres; a
  // single-kind selection keeps its only axis on the left.
  const moneyAxis = hasCount ? "right" : "left"
  const totals = data ? periodTotals(data, creatorsTotal) : null
  const splitLabel = new Map((gmvSplit ?? []).map((s) => [s.key, s.label]))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex-1 text-[15px] font-semibold text-[var(--ov-soft)]">{title}</div>
        {headerExtra}
        {picker === "select" && (
          <MultiSelect
            label="Metrik"
            options={METRIC_KEYS}
            selected={metrics}
            onChangeAction={(values) => values.length > 0 && setMetrics(values as TrendMetricKey[])}
            max={MAX_TREND_METRICS}
            optionLabel={(v) => TREND_METRICS[v as TrendMetricKey].label}
            width="w-52"
          />
        )}
      </div>

      {picker === "cards" && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {METRIC_KEYS.map((key) => {
            const def = TREND_METRICS[key]
            const on = metrics.includes(key)
            const blocked = !on && metrics.length >= MAX_TREND_METRICS
            const hover = cardHover?.[key]
            return (
              <div key={key} className="group relative">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  disabled={blocked}
                  title={blocked ? `Maksimal ${MAX_TREND_METRICS} metrik` : on ? "Klik untuk sembunyikan dari grafik" : "Klik untuk tampilkan di grafik"}
                  className="flex h-full w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: on ? def.color : "var(--ov-line)",
                    background: on ? "var(--ov-fill1)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-wide text-[var(--ov-mut)] uppercase">
                    <i className="block h-2.5 w-2.5 flex-none rounded-sm" style={{ background: on ? def.color : "var(--ov-track)" }} />
                    {def.label}
                    <span
                      className="ml-auto flex h-4 w-4 flex-none items-center justify-center rounded border text-[11.5px] font-bold"
                      style={{
                        borderColor: on ? def.color : "var(--ov-rule)",
                        background: on ? def.color : "transparent",
                        color: "#0a1628",
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </span>
                  <span
                    className={`mt-1 font-mono text-[15px] font-semibold text-[var(--ov-ink)] ${hover ? "border-b border-dotted border-[var(--ov-track)]" : ""}`}
                  >
                    {totals ? formatValue(key, totals[key]) : "…"}
                  </span>
                  {cardNotes?.[key] && <span className="mt-0.5 text-[12.5px] text-[var(--ov-faint)]">{cardNotes[key]}</span>}
                </button>
                {hover && <div className="absolute top-full left-0 z-50 hidden pt-2 group-hover:block">{hover}</div>}
              </div>
            )
          })}
          {infoCards?.map((card) => (
            <div
              key={card.label}
              className="flex flex-col rounded-lg border border-dashed border-[var(--ov-line)] px-3 py-2"
              title="Atribut dari marketplace centre, tanpa tren harian"
            >
              <span className="text-[12.5px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">{card.label}</span>
              <span className="mt-1 font-mono text-[15px] font-semibold text-[var(--ov-soft)]">{card.value}</span>
              {card.note && <span className="mt-0.5 text-[12.5px] text-[var(--ov-faint)]">{card.note}</span>}
            </div>
          ))}
        </div>
      )}
      {picker === "cards" && (
        <div className="mt-2 text-[12px] text-[var(--ov-faint)]">
          Kotak bergaris tegas bisa diklik untuk ditampilkan di grafik (maks. {MAX_TREND_METRICS}); kotak bergaris putus-putus
          adalah atribut marketplace centre tanpa tren harian.
        </div>
      )}

      {picker === "select" && (
        <div className="mt-2 flex flex-wrap gap-3 text-[13px] text-[var(--ov-mut)]">
          {(showSplit ? (gmvSplit ?? []) : metrics.map((k) => ({ key: k, label: TREND_METRICS[k].label, color: TREND_METRICS[k].color }))).map(
            (s) => (
              <span key={s.key} className="flex items-center gap-1.5 font-semibold">
                <i className="block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ),
          )}
        </div>
      )}

      {data ? (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--ov-line)" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            {hasCount && (
              <YAxis
                yAxisId="count"
                orientation="left"
                tickFormatter={(v) => formatCompact(Number(v))}
                tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
            )}
            {hasMoney && (
              <YAxis
                yAxisId="money"
                orientation={moneyAxis}
                tickFormatter={(v) => `Rp${formatCompact(Number(v))}`}
                tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
            )}
            <Tooltip {...TOOLTIP_PLACEMENT}
              contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12.5 }}
              labelStyle={{ color: "var(--ov-head)", fontWeight: 600 }}
              itemStyle={{ color: "var(--ov-ink)" }}
              formatter={(value, name) => {
                const key = String(name)
                if (showSplit) return [formatRpFull(Number(value)), splitLabel.get(key) ?? key]
                const metric = key as TrendMetricKey
                return [formatValue(metric, value === null ? null : Number(value)), TREND_METRICS[metric]?.label ?? key]
              }}
            />
            {showSplit
              ? (gmvSplit ?? []).map((s) => (
                  <Area
                    key={s.key}
                    yAxisId="money"
                    type="monotone"
                    dataKey={s.key}
                    stackId="split"
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.3}
                    strokeWidth={1.5}
                  />
                ))
              : metrics.map((key) => (
                  <Area
                    key={key}
                    yAxisId={TREND_METRICS[key].kind}
                    type="monotone"
                    dataKey={key}
                    stroke={TREND_METRICS[key].color}
                    fill={TREND_METRICS[key].color}
                    // A lone series keeps the filled look; overlapping fills would hide each other.
                    fillOpacity={metrics.length === 1 ? 0.22 : 0}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center text-sm text-[var(--ov-faint)]" style={{ height }}>
          Loading…
        </div>
      )}
    </div>
  )
}
