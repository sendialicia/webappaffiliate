"use client"

import { PerformanceComboChart, type ComboPoint } from "./performance-combo-chart"
import { formatDateLabel } from "@/lib/format"
import type { DailyPerformancePoint } from "@/types/overview"

export function DailyPerformanceChart({ days }: { days: DailyPerformancePoint[] }) {
  const data: ComboPoint[] = days.map((d) => ({
    key: d.date,
    label: formatDateLabel(d.date),
    actualGmv: d.actualGmv,
    lyGmv: d.lyGmv,
    target: d.target,
  }))

  return <PerformanceComboChart data={data} height={280} />
}
