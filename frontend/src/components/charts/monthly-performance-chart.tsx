"use client"

import { PerformanceComboChart, type ComboPoint } from "./performance-combo-chart"
import { formatMonthLabel } from "@/lib/format"
import type { MonthlyPerformancePoint } from "@/types/overview"

export function MonthlyPerformanceChart({
  months,
  onMonthClick,
}: {
  months: MonthlyPerformancePoint[]
  onMonthClick: (month: string) => void
}) {
  const data: ComboPoint[] = months.map((m) => ({
    key: m.month.slice(0, 7),
    label: formatMonthLabel(m.month),
    actualGmv: m.actualGmv,
    lyGmv: m.lyGmv,
    target: m.target,
  }))

  return <PerformanceComboChart data={data} onPointClick={onMonthClick} />
}
