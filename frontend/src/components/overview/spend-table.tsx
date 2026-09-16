"use client"

import { useState } from "react"
import { ROI_THRESHOLD } from "@/components/charts/roi-chart"
import { formatIdr, formatPercent } from "@/lib/format"
import type { SpendRow } from "@/types/overview"

type SortKey = keyof SpendRow

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "name", label: "Nama", align: "left" },
  { key: "commissionRate", label: "Comm rate", align: "right" },
  { key: "roi", label: "ROI", align: "right" },
  { key: "gmv", label: "GMV", align: "right" },
  { key: "commission", label: "Commission", align: "right" },
  { key: "gmvPerCreator", label: "GMV/creator", align: "right" },
  { key: "creators", label: "Creators", align: "right" },
]

export function SpendTable({ rows }: { rows: SpendRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === "string" || typeof bv === "string") {
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    }
    return asc ? Number(av) - Number(bv) : Number(bv) - Number(av)
  })

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="cursor-pointer border-b border-[var(--ov-line)] p-2 text-[10.5px] font-bold tracking-wider whitespace-nowrap text-[var(--ov-head)] uppercase select-none"
                style={{ textAlign: col.align }}
              >
                {col.label}
                <span className="ml-1 text-[9px] text-[var(--ov-blue)]">
                  {sortKey === col.key ? (asc ? "▲" : "▼") : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.name} className="hover:bg-[var(--ov-fill1)]">
              <td className="border-b border-[var(--ov-line)] p-2 font-semibold">{row.name}</td>
              <td className="border-b border-[var(--ov-line)] p-2 text-right font-mono font-semibold">
                {formatPercent(row.commissionRate, 2)}
              </td>
              <td
                className="border-b border-[var(--ov-line)] p-2 text-right font-mono font-semibold"
                style={{ color: row.roi >= ROI_THRESHOLD ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
              >
                {row.roi.toFixed(1)}x
              </td>
              <td className="border-b border-[var(--ov-line)] p-2 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.gmv)}
              </td>
              <td className="border-b border-[var(--ov-line)] p-2 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.commission)}
              </td>
              <td className="border-b border-[var(--ov-line)] p-2 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.gmvPerCreator)}
              </td>
              <td className="border-b border-[var(--ov-line)] p-2 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.creators)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
