export type CsvValue = string | number | boolean | null | undefined
export type CsvRow = Record<string, CsvValue>

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Columns are the union of every row's keys, so a sparse row still lines up. */
export function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ""
  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }

  const lines = [columns.map(escapeCell).join(",")]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c])).join(","))
  }
  return lines.join("\r\n")
}

export function downloadCsv(filename: string, rows: CsvRow[]): void {
  // The BOM makes Excel read the file as UTF-8 instead of the local codepage.
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
