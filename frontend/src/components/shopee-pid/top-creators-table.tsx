"use client"

import { useState } from "react"
import { formatIdr, formatPercent } from "@/lib/format"
import type { PidCreatorRow } from "@/types/shopee-pid"
import { Num } from "@/components/num"

type SortKey = keyof PidCreatorRow | "livestream" | "video" | "productCard"

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "username", label: "Creator" },
  { key: "gmv", label: "GMV" },
  { key: "livestream", label: "Livestream" },
  { key: "video", label: "Video" },
  { key: "productCard", label: "Product Card" },
  { key: "share", label: "% Share" },
  { key: "orders", label: "Orders" },
  { key: "itemsSold", label: "Items" },
  { key: "commission", label: "Commission" },
  { key: "aov", label: "AOV" },
]

export function TopCreatorsTable({ rows, onSelectAction }: { rows: PidCreatorRow[]; onSelectAction?: (username: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

  const valueOf = (r: PidCreatorRow, key: SortKey) =>
    key === "livestream" || key === "video" || key === "productCard" ? r.pillars[key] : r[key]

  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a, sortKey)
    const bv = valueOf(b, sortKey)
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
      <table className="w-full min-w-[860px] border-collapse text-[13px]">
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
              <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono">{formatIdr(row.gmv)}</td>
              {(["livestream", "video", "productCard"] as const).map((k) => (
                <td
                  key={k}
                  className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]"
                >
                  {row.pillars[k] > 0 ? <Num value={row.pillars[k]} /> : "—"}
                </td>
              ))}
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
