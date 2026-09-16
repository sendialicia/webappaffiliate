export function formatIdr(value: number): string {
  // Comma grouping to match the reference mockup's number style (e.g. "192,161,886,201"),
  // not the id-ID locale default of dot grouping.
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

/** Headline money, the way the reference mockup writes it: "Rp245.3B". */
export function formatRp(value: number): string {
  const sign = value < 0 ? "−" : ""
  return `${sign}Rp${formatCompact(Math.abs(value))}`
}

/** Exact money, the way the mockup writes it in tables: "Rp66,812,309,659". */
export function formatRpFull(value: number): string {
  const sign = value < 0 ? "−" : ""
  return `${sign}Rp${formatIdr(Math.abs(value))}`
}

/** Signed headline money for deltas: "+Rp12.4B". */
export function formatSignedRp(value: number): string {
  return `${value >= 0 ? "+" : "−"}Rp${formatCompact(Math.abs(value))}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function formatSignedPercent(value: number | null, digits = 1): string {
  if (value === null) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${(value * 100).toFixed(digits)}%`
}

export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export function formatMonthLabelFull(month: string): string {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { day: "2-digit", month: "short" })
}
