"use client"

import { useState } from "react"
import { formatIdr, formatPercent } from "@/lib/format"
import type { SkuCreatorRow } from "@/types/sku"

/** Not a person: TikTok books agency sales under this one username. */
export const AGENCY_USERNAME = "Agency"

type SortKey = keyof SkuCreatorRow

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "username", label: "Creator" },
  { key: "marketplaces", label: "Marketplace" },
  { key: "gmv", label: "GMV" },
  { key: "share", label: "% Share" },
  { key: "orders", label: "Orders" },
  { key: "itemsSold", label: "Items" },
  { key: "commission", label: "Commission" },
  { key: "aov", label: "AOV" },
]

export function SkuTopCreatorsTable({ rows, onSelectAction }: { rows: SkuCreatorRow[]; onSelectAction?: (username: string) => void }) {
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
    <div className="max-h-[520px] overflow-auto xl:h-full xl:max-h-none">
      <table className="w-full min-w-[700px] border-collapse text-[13px]">
        <thead>
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="sticky top-0 z-[2] cursor-pointer bg-[var(--card)] p-2.5 text-[12px] font-bold tracking-wide whitespace-nowrap text-[var(--ov-head)] uppercase shadow-[inset_0_-2px_0_var(--ov-track)] select-none"
                style={{ textAlign: i === 0 ? "left" : "right" }}
              >
                {col.label}
                <span className="ml-1 text-[10.5px] text-[var(--ov-blue)]">
                  {sortKey === col.key ? (asc ? "▲" : "▼") : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.username}
              onClick={() => onSelectAction?.(row.username)}
              title={onSelectAction ? "Klik untuk melihat profil creator ini" : undefined}
              className={`hover:bg-[var(--ov-fill1)] ${onSelectAction ? "cursor-pointer" : ""}`}
            >
              <td className="border-b border-[var(--ov-fill1)] p-2.5 font-semibold">
                <span className="flex flex-wrap items-center gap-2">
                  {row.username}
                  {row.username === AGENCY_USERNAME && (
                    <span
                      title="Agregat penjualan agency, bukan satu creator — lihat catatan di bawah tabel"
                      className="rounded px-1.5 py-0.5 text-[11.5px] font-bold tracking-wide uppercase"
                      style={{ background: "var(--ov-gold)", color: "var(--ov-logo-ink, #1b2a44)" }}
                    >
                      agregat
                    </span>
                  )}
                  <span
                    className="rounded px-1.5 py-0.5 text-[11.5px] font-bold tracking-wide uppercase"
                    style={{
                      background: row.isManaged ? "var(--accent)" : "var(--ov-fill1)",
                      color: row.isManaged ? "var(--accent-foreground)" : "var(--ov-faint)",
                    }}
                  >
                    {row.isManaged ? "Managed" : "Organic"}
                  </span>
                </span>
              </td>
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right text-[12px] whitespace-nowrap text-[var(--ov-soft)]">
                {row.marketplaces}
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
