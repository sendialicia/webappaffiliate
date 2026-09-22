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
  const data =
    unit === "share"
      ? rows.map((row) => {
          const total = names.reduce((acc, n) => acc + Math.max(Number(row[n]) || 0, 0), 0)
          const out: DriverChartRow = { entity: row.entity }
          for (const n of names) {
            const v = Math.max(Number(row[n]) || 0, 0)
            out[n] = total > 0 ? (v / total) * 100 : 0
            out[`${RAW_PREFIX}${n}`] = v
          }
          return out
        })
      : rows

  const fmt = (v: number) => (unit === "pp" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp` : formatCompact(v))
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
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          // Largest first, so the reader sees what moved the entity most without scanning.
          itemSorter={(item) => -Number(item.value ?? 0)}
          formatter={(value, name, item) => {
            if (unit !== "share") return [fmt(Number(value)), String(name)]
            const raw = Number((item?.payload as DriverChartRow | undefined)?.[`${RAW_PREFIX}${String(name)}`] ?? 0)
            return [`${Number(value).toFixed(1)}% · ${formatCompact(raw)}`, String(name)]
          }}
        />
        {unit !== "share" && <ReferenceLine x={0} stroke="var(--ov-rule)" />}
        {names.map((name, i) => (
          <Bar key={name} dataKey={name} stackId="s" fill={DIMENSION_COLORS[i % DIMENSION_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Keeps each segment's GMV next to its share without colliding with a dimension value's name. */
const RAW_PREFIX = "__raw__"

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
            style={{ background: DIMENSION_COLORS[i % DIMENSION_COLORS.length] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}
