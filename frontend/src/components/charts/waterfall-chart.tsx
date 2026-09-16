"use client"

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCompact } from "@/lib/format"
import type { CompositionResult } from "@/types/overview"

interface WaterfallStep {
  name: string
  base: number
  value: number
  delta: number
  kind: "total" | "up" | "down"
}

function buildSteps(result: CompositionResult): WaterfallStep[] {
  const steps: WaterfallStep[] = [
    {
      name: "Periode lalu",
      base: 0,
      value: result.totals.previous,
      delta: result.totals.previous,
      kind: "total",
    },
  ]

  let running = result.totals.previous
  for (const row of result.rows) {
    const base = row.delta >= 0 ? running : running + row.delta
    steps.push({
      name: row.name,
      base,
      value: Math.abs(row.delta),
      delta: row.delta,
      kind: row.delta >= 0 ? "up" : "down",
    })
    running += row.delta
  }

  // Rows can be truncated by the API's limit; this keeps the bridge exact.
  const remainder = result.totals.current - running
  if (Math.abs(remainder) > 0.5) {
    const base = remainder >= 0 ? running : running + remainder
    steps.push({
      name: "Lainnya",
      base,
      value: Math.abs(remainder),
      delta: remainder,
      kind: remainder >= 0 ? "up" : "down",
    })
  }

  steps.push({
    name: "Periode ini",
    base: 0,
    value: result.totals.current,
    delta: result.totals.current,
    kind: "total",
  })

  return steps
}

const COLORS: Record<WaterfallStep["kind"], string> = {
  total: "var(--ov-blue)",
  up: "var(--ov-green)",
  down: "var(--ov-red)",
}

export function WaterfallChart({ result, height = 296 }: { result: CompositionResult; height?: number }) {
  const steps = buildSteps(result)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={steps} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={{ stroke: "var(--ov-line)" }}
          tickLine={false}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={62}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "var(--ov-fill1)" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ov-head)" }}
          formatter={(_value, _name, item) => {
            const step = item?.payload as WaterfallStep | undefined
            if (!step) return ["", ""]
            const sign = step.kind === "total" ? "" : step.delta >= 0 ? "+" : "-"
            return [`${sign}${formatCompact(Math.abs(step.delta))}`, step.kind === "total" ? "Total" : "Kontribusi"]
          }}
        />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]}>
          {steps.map((step, i) => (
            <Cell key={i} fill={COLORS[step.kind]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
