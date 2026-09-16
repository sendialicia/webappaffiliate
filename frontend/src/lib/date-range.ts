export type DatePreset = "mtd" | "qtd" | "ytd" | "last-quarter" | "custom"

export interface DateRange {
  from: string
  to: string
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
  "last-quarter": "Last Quarter",
  custom: "Custom",
}

function toIso(date: Date): string {
  // Format using local date components, not toISOString (which converts to UTC
  // and can shift the calendar day backward/forward for non-zero UTC offsets).
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfQuarter(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), quarterStartMonth, 1)
}

export function computePresetRange(preset: DatePreset, today: Date = new Date()): DateRange {
  switch (preset) {
    case "mtd":
      return { from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIso(today) }
    case "qtd":
      return { from: toIso(startOfQuarter(today)), to: toIso(today) }
    case "ytd":
      return { from: toIso(new Date(today.getFullYear(), 0, 1)), to: toIso(today) }
    case "last-quarter": {
      const currentQuarterStart = startOfQuarter(today)
      const lastQuarterEnd = new Date(currentQuarterStart)
      lastQuarterEnd.setDate(lastQuarterEnd.getDate() - 1)
      const lastQuarterStart = startOfQuarter(lastQuarterEnd)
      return { from: toIso(lastQuarterStart), to: toIso(lastQuarterEnd) }
    }
    case "custom":
    default:
      return { from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIso(today) }
  }
}

export function currentMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
}
