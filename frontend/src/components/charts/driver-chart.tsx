"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { DIMENSION_COLORS } from "@/components/overview/composition-table"
import { formatCompact } from "@/lib/format"
import type { DriverChartRow, EntityGrowthRow } from "@/types/overview"

/** One entity per row; tall enough that a 14-brand chart is not a stack of hairlines. */
export const DRIVER_ROW_HEIGHT = 30
/** Room for the axis and its labels on top of the rows. */
const DRIVER_AXIS_SPACE = 40
/** Past this the block scrolls instead of growing; roughly a screenful. */
export const DRIVER_MAX_HEIGHT = 620

export function driverChartHeight(rowCount: number): number {
  return Math.max(240, rowCount * DRIVER_ROW_HEIGHT + DRIVER_AXIS_SPACE)
}

/** Room for entity names on the one panel that shows them; the others hide the axis. */
export const DRIVER_LABEL_WIDTH = 96

/**
 * Each bar orders its own segments — largest nearest the axis — while a dimension value keeps
 * one colour everywhere. Recharts stacks series in a fixed order, so the rows are re-shaped
 * into rank series (the k-th largest segment of every row) and each cell is coloured by the
 * dimension value that holds that rank in its row.
 */
interface RankedRow {
  entity: string
  [key: string]: string | number | null
}

/** The backend folds everything past the top N into this; it stays grey and at the bar's end. */
export const DRIVER_OTHER = "Lainnya"
const OTHER_COLOR = "var(--ov-dim)"

export function driverColor(name: string, index: number): string {
  return name === DRIVER_OTHER ? OTHER_COLOR : (DIMENSION_COLORS[index % DIMENSION_COLORS.length] as string)
}

const rankValue = (k: number) => `__v${k}`
const rankName = (k: number) => `__n${k}`
const rankColor = (k: number) => `__c${k}`
const rankRaw = (k: number) => `__r${k}`

function rankRows(
  rows: DriverChartRow[],
  names: string[],
  unit: "currency" | "pp" | "share",
): { data: RankedRow[]; depth: number } {
  let depth = 0
  const data = rows.map((row) => {
    const total =
      unit === "share" ? names.reduce((acc, n) => acc + Math.max(Number(row[n]) || 0, 0), 0) : 0
    const segments = names
      .map((name, i) => {
        const raw = Number(row[name]) || 0
        const value = unit === "share" ? (total > 0 ? (Math.max(raw, 0) / total) * 100 : 0) : raw
        return { name, raw, value, color: driverColor(name, i) }
      })
      .filter((seg) => seg.value !== 0)
      // Signed charts sort by size either side of zero, so the biggest mover sits at the axis.
      .sort((a, b) =>
        a.name === DRIVER_OTHER ? 1 : b.name === DRIVER_OTHER ? -1 : Math.abs(b.value) - Math.abs(a.value),
      )
    depth = Math.max(depth, segments.length)
    const out: RankedRow = { entity: String(row.entity) }
    segments.forEach((seg, k) => {
      out[rankValue(k)] = seg.value
      out[rankName(k)] = seg.name
      out[rankColor(k)] = seg.color
      out[rankRaw(k)] = seg.raw
    })
    return out
  })
  return { data, depth }
}

function DriverTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ payload?: RankedRow }>
  unit: "currency" | "pp" | "share"
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const items: Array<{ name: string; value: number; raw: number; color: string }> = []
  for (let k = 0; row[rankName(k)] !== undefined; k++) {
    items.push({
      name: String(row[rankName(k)]),
      value: Number(row[rankValue(k)]),
      raw: Number(row[rankRaw(k)]),
      color: String(row[rankColor(k)]),
    })
  }
  // Largest first; for signed charts gains before losses, each by size.
  items.sort((a, b) => (a.name === DRIVER_OTHER ? 1 : b.name === DRIVER_OTHER ? -1 : b.value - a.value))
  const fmt = (item: (typeof items)[number]) =>
    unit === "share"
      ? `${item.value.toFixed(1)}% · ${formatCompact(item.raw)}`
      : unit === "pp"
        ? `${item.value >= 0 ? "+" : ""}${item.value.toFixed(1)}pp`
        : `${item.value >= 0 ? "+" : "−"}${formatCompact(Math.abs(item.value))}`
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[12.5px]"
      style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
    >
      <div className="mb-1 font-semibold text-[var(--ov-head)]">{row.entity}</div>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2 py-0.5">
          <i className="block h-2.5 w-2.5 flex-none rounded-sm" style={{ background: item.color }} />
          <span className="text-[var(--ov-soft)]">{item.name}</span>
          <span className="ml-auto pl-4 font-mono text-[var(--ov-ink)]">{fmt(item)}</span>
        </div>
      ))}
    </div>
  )
}

export function DriverChart({
  rows,
  names,
  height = 330,
  unit = "currency",
  showLabels = true,
}: {
  rows: DriverChartRow[]
  names: string[]
  height?: number
  /**
   * "pp" renders growth contribution in percentage points; "share" stacks each entity to
   * 100% so its mix reads at a glance, with the GMV itself kept for the tooltip.
   */
  unit?: "currency" | "pp" | "share"
  /** Panels sit side by side on shared rows, so only the first one needs the entity names. */
  showLabels?: boolean
}) {
  const { data, depth } = rankRows(rows, names, unit)
  const tick = (v: number) =>
    unit === "pp" || unit === "share" ? `${Math.round(v)}%` : formatCompact(v)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 0, bottom: 4 }}
        // Positive segments stack rightward from zero and negative ones leftward. Plain stacking
        // runs them in sequence, so a loss mid-stack drags every later gain back across zero.
        stackOffset={unit === "share" ? "none" : "sign"}
      >
        <CartesianGrid stroke="var(--ov-line)" horizontal={false} />
        <XAxis
          type="number"
          orientation="top"
          domain={unit === "share" ? [0, 100] : undefined}
          ticks={unit === "share" ? [0, 25, 50, 75, 100] : undefined}
          tickFormatter={(v) => tick(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="entity"
          hide={!showLabels}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={DRIVER_LABEL_WIDTH}
        />
        <Tooltip cursor={{ fill: "var(--ov-fill1)" }} content={<DriverTooltip unit={unit} />} />
        {unit !== "share" && <ReferenceLine x={0} stroke="var(--ov-rule)" />}
        {Array.from({ length: depth }, (_, k) => (
          <Bar key={k} dataKey={rankValue(k)} stackId="s" isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.entity} fill={String(row[rankColor(k)] ?? "transparent")} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}


/**
 * Growth reads as one bar per entity, like the reference mockup — a bar per dimension value
 * on the same axis renders as hairlines once an entity has more than a few of them.
 */
export function EntityGrowthChart({ rows, height = 330 }: { rows: EntityGrowthRow[]; height?: number }) {
  const data = rows.map((r) => ({ entity: r.entity, growth: r.growth ?? 0, missing: r.growth === null }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--ov-line)" horizontal={false} />
        <XAxis
          type="number"
          orientation="top"
          tickFormatter={(v) => `${Math.round(Number(v))}%`}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="entity" hide />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          itemStyle={{ color: "var(--ov-ink)" }}
          formatter={(value, _name, item) => [
            (item?.payload as { missing?: boolean })?.missing ? "—" : `${Number(value).toFixed(1)}%`,
            "Growth GMV",
          ]}
        />
        <ReferenceLine x={0} stroke="var(--ov-rule)" />
        <Bar dataKey="growth" barSize={14} radius={3}>
          {data.map((d) => (
            <Cell key={d.entity} fill={d.growth >= 0 ? "var(--ov-green)" : "var(--ov-red)"} />
          ))}
          <LabelList
            dataKey="growth"
            position="right"
            offset={6}
            fontSize={11}
            fill="var(--ov-soft)"
            formatter={(v) => {
              const n = Number(v)
              return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : ""
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DriverLegend({ names }: { names: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 pt-11">
      {names.map((name, i) => (
        <span
          key={name}
          className="flex items-center gap-2 text-[12.5px] font-semibold whitespace-nowrap text-[var(--ov-soft)]"
        >
          <i
            className="block h-2.5 w-2.5 flex-none rounded-sm"
            style={{ background: driverColor(name, i) }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}
