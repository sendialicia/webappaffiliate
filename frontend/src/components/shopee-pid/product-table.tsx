"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { PidProductRow } from "@/types/shopee-pid"

type SortKey =
  | "name"
  | "gmv"
  | "growth"
  | "share"
  | "creators"
  | "livestream"
  | "video"
  | "productCard"
  | "spGmv"
  | "spOrders"
  | "spClicks"
  | "spCoRate"
  | "spBuyers"
  | "spNewBuyers"
  | "spProductSold"
  | "spCommission"
  | "spRoi"

const COLUMNS: Array<{ key: SortKey; label: string; group?: "pillar" | "shopee" }> = [
  { key: "name", label: "Produk" },
  { key: "gmv", label: "GMV" },
  { key: "growth", label: "Growth" },
  { key: "share", label: "% Share" },
  { key: "creators", label: "Creators" },
  { key: "livestream", label: "Livestream", group: "pillar" },
  { key: "video", label: "Video", group: "pillar" },
  { key: "productCard", label: "Product Card", group: "pillar" },
  { key: "spGmv", label: "SP GMV", group: "shopee" },
  { key: "spOrders", label: "Orders", group: "shopee" },
  { key: "spClicks", label: "Clicks", group: "shopee" },
  { key: "spCoRate", label: "CO Rate", group: "shopee" },
  { key: "spBuyers", label: "Buyers", group: "shopee" },
  { key: "spNewBuyers", label: "New Buyers", group: "shopee" },
  { key: "spProductSold", label: "Sold", group: "shopee" },
  { key: "spCommission", label: "Est Comm", group: "shopee" },
  { key: "spRoi", label: "ROI", group: "shopee" },
]

function valueOf(row: PidProductRow, key: SortKey): number | string | null {
  if (key === "livestream") return row.pillars.livestream
  if (key === "video") return row.pillars.video
  if (key === "productCard") return row.pillars.productCard
  if (key === "name") return row.name
  return row[key]
}

function cellOf(row: PidProductRow, key: SortKey): { text: string; color?: string } {
  switch (key) {
    case "growth":
      return {
        text: formatSignedPercent(row.growth),
        color: (row.growth ?? 0) >= 0 ? "var(--ov-green)" : "var(--ov-red)",
      }
    case "share":
      return { text: formatPercent(row.share, 2) }
    case "spRoi":
      return { text: row.spRoi !== null ? `${row.spRoi.toFixed(1)}x` : "—" }
    case "spCoRate":
      return { text: row.spCoRate !== null ? formatPercent(row.spCoRate, 2) : "—" }
    case "livestream":
    case "video":
    case "productCard":
      return { text: formatCompact(row.pillars[key]) }
    case "gmv":
    case "spGmv":
    case "spCommission":
      return { text: formatCompact(row[key]) }
    default:
      return { text: formatIdr(Number(row[key] ?? 0)) }
  }
}

export function ProductTable({
  rows,
  selectedPid,
  onSelectAction,
  showPillars,
  showShopee,
}: {
  rows: PidProductRow[]
  selectedPid: string | null
  onSelectAction: (pid: string) => void
  showPillars: boolean
  showShopee: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

  const columns = COLUMNS.filter(
    (c) => (c.group !== "pillar" || showPillars) && (c.group !== "shopee" || showShopee),
  )

  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a, sortKey)
    const bv = valueOf(b, sortKey)
    if (typeof av === "string" || typeof bv === "string") {
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    }
    const an = av ?? -Infinity
    const bn = bv ?? -Infinity
    return asc ? an - bn : bn - an
  })

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <div className="max-h-[440px] overflow-auto rounded-lg border border-[var(--ov-line)]">
      <table className="w-full border-collapse text-[12.5px]" style={{ minWidth: 300 + columns.length * 88 }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
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
          {sorted.map((row) => {
            const selected = selectedPid === row.pid
            return (
              <tr
                key={row.pid}
                onClick={() => onSelectAction(row.pid)}
                className="cursor-pointer hover:bg-[var(--ov-fill1)]"
                style={{ background: selected ? "var(--accent)" : undefined }}
              >
                {columns.map((col, i) => {
                  if (i === 0) {
                    return (
                      <td
                        key={col.key}
                        title={row.name}
                        className="border-b border-[var(--ov-fill1)] p-2.5 text-[var(--ov-ink)]"
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className="mt-1 block h-1.5 w-1.5 flex-none rounded-full"
                            style={{ background: row.inScope ? "var(--ov-gold)" : "transparent" }}
                          />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-mono text-[11px] text-[var(--ov-faint)]">{row.pid}</span>
                            <span className="line-clamp-2">{row.name}</span>
                          </span>
                        </span>
                      </td>
                    )
                  }
                  const cell = cellOf(row, col.key)
                  return (
                    <td
                      key={col.key}
                      className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono whitespace-nowrap"
                      style={{ color: cell.color }}
                    >
                      {cell.text}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="px-4 py-8 text-center">
          <div className="text-sm font-semibold">Tidak ada produk yang cocok</div>
          <div className="mt-1.5 text-xs text-[var(--ov-faint)]">
            Coba ubah kata kunci pencarian atau lepas cakupan kategori.
          </div>
        </div>
      )}
    </div>
  )
}
