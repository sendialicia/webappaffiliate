"use client"

import { useState } from "react"
import { formatIdr, formatPercent } from "@/lib/format"
import type { PidCreatorRow } from "@/types/shopee-pid"

type SortKey = keyof PidCreatorRow

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "username", label: "Creator" },
  { key: "gmv", label: "GMV" },
  { key: "share", label: "% Share" },
  { key: "orders", label: "Orders" },
  { key: "itemsSold", label: "Items" },
  { key: "commission", label: "Commission" },
  { key: "aov", label: "AOV" },
]

export function TopCreatorsTable({ rows }: { rows: PidCreatorRow[] }) {
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
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="sticky top-0 z-[2] cursor-pointer bg-[var(--card)] p-2.5 text-[10.5px] font-bold tracking-wide whitespace-nowrap text-[var(--ov-head)] uppercase shadow-[inset_0_-2px_0_var(--ov-track)] select-none"
                style={{ textAlign: i === 0 ? "left" : "right" }}
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
            <tr key={row.username} className="hover:bg-[var(--ov-fill1)]">
              <td className="border-b border-[var(--ov-fill1)] p-2.5 font-semibold">
                <span className="flex flex-wrap items-center gap-2">
                  {row.username}
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                    style={{
                      background: row.isManaged ? "var(--accent)" : "var(--ov-fill1)",
                      color: row.isManaged ? "var(--accent-foreground)" : "var(--ov-faint)",
                    }}
                  >
                    {row.isManaged ? "Managed" : "Organic"}
                  </span>
                </span>
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono">{formatIdr(row.gmv)}</td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono font-semibold">
                {formatPercent(row.share, 2)}
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.orders)}
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.itemsSold)}
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.commission)}
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                {formatIdr(row.aov)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
