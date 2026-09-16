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

export function DriverChart({
  rows,
  names,
  height = 330,
  unit = "currency",
}: {
  rows: DriverChartRow[]
  names: string[]
  height?: number
  /** "pp" renders growth contribution in percentage points. */
  unit?: "currency" | "pp"
}) {
  const fmt = (v: number) => (unit === "pp" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp` : formatCompact(v))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => (unit === "pp" ? `${Math.round(Number(v))}%` : formatCompact(Number(v)))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="entity"
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={78}
        />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(value, name) => [fmt(Number(value)), String(name)]}
        />
        <ReferenceLine x={0} stroke="var(--ov-rule)" />
        {names.map((name, i) => (
          <Bar key={name} dataKey={name} stackId="s" fill={DIMENSION_COLORS[i % DIMENSION_COLORS.length]} />
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
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--ov-line)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${Math.round(Number(v))}%`}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="entity" hide />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
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
    <div className="flex flex-col gap-1.5 pt-10">
      {names.map((name, i) => (
        <span
          key={name}
          className="flex items-center gap-2 text-[11.5px] font-semibold whitespace-nowrap text-[var(--ov-soft)]"
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
