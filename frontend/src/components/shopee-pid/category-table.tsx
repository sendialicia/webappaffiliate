"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { PidCategoryRow } from "@/types/shopee-pid"

type SortKey =
  | "name"
  | "gmv"
  | "share"
  | "deltaRp"
  | "growth"
  | "livestream"
  | "video"
  | "productCard"
  | "orders"
  | "spClicks"
  | "spBuyers"
  | "spNewBuyers"
  | "itemsSold"
  | "commission"
  | "roi"
  | "spCoRate"

const COLUMNS: Array<{ key: SortKey; label: string; group?: "pillar" | "shopee" }> = [
  { key: "name", label: "Kategori" },
  { key: "gmv", label: "GMV" },
  { key: "share", label: "% Share" },
  { key: "deltaRp", label: "Δ Rp" },
  { key: "growth", label: "GMV Growth" },
  { key: "livestream", label: "GMV Livestream", group: "pillar" },
  { key: "video", label: "GMV Video", group: "pillar" },
  { key: "productCard", label: "GMV Product Card", group: "pillar" },
  { key: "orders", label: "Orders", group: "shopee" },
  { key: "spClicks", label: "Clicks", group: "shopee" },
  { key: "spCoRate", label: "CO Rate (centre)", group: "shopee" },
  { key: "spBuyers", label: "Buyers", group: "shopee" },
  { key: "spNewBuyers", label: "New Buyers", group: "shopee" },
  { key: "itemsSold", label: "Items Sold", group: "shopee" },
  { key: "commission", label: "Commission", group: "shopee" },
  { key: "roi", label: "ROI", group: "shopee" },
]

function valueOf(row: PidCategoryRow, key: SortKey): number | string | null {
  if (key === "livestream") return row.pillars.livestream
  if (key === "video") return row.pillars.video
  if (key === "productCard") return row.pillars.productCard
  if (key === "name") return row.name
  return row[key]
}

function renderCell(row: PidCategoryRow, key: SortKey) {
  switch (key) {
    case "share":
      return { text: formatPercent(row.share), color: undefined }
    case "growth":
      return {
        text: formatSignedPercent(row.growth),
        color: (row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
    case "deltaRp":
      return {
        text: `${row.deltaRp >= 0 ? "+" : "−"}${formatCompact(Math.abs(row.deltaRp))}`,
        color: row.deltaRp >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
    case "roi":
      return { text: row.roi !== null ? `${row.roi.toFixed(1)}x` : "—", color: undefined }
    case "spCoRate":
      return { text: row.spCoRate !== null ? formatPercent(row.spCoRate, 2) : "—", color: undefined }
    case "livestream":
      return { text: formatCompact(row.pillars.livestream), color: undefined }
    case "video":
      return { text: formatCompact(row.pillars.video), color: undefined }
    case "productCard":
      return { text: formatCompact(row.pillars.productCard), color: undefined }
    case "gmv":
    case "commission":
      return { text: formatIdr(row[key]), color: undefined }
    default:
      return { text: formatIdr(Number(row[key] ?? 0)), color: undefined }
  }
}

export function CategoryTable({
  total,
  rows,
  scope,
  onScopeAction,
  onToggleScopeAction,
  showPillars,
  showShopee,
}: {
  total: PidCategoryRow
  rows: PidCategoryRow[]
  scope: string[]
  /** Clicking a row makes it the only scope; the checkbox adds or removes one. */
  onScopeAction: (names: string[]) => void
  onToggleScopeAction: (name: string) => void
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
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-[13px]" style={{ minWidth: 220 + columns.length * 92 }}>
        <thead>
          <tr>
            <th className="w-9 bg-[var(--accent)] p-2.5">
              <span className="sr-only">Pilih</span>
            </th>
            {columns.map((col, i) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="cursor-pointer rounded-md bg-[var(--accent)] p-2.5 text-[12px] font-bold tracking-wide whitespace-nowrap text-[var(--ov-head)] uppercase select-none"
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
          <tr>
            <td className="p-2.5" />
            {columns.map((col, i) => {
              const cell = renderCell(total, col.key)
              return (
                <td
                  key={col.key}
                  className="rounded-md bg-[var(--ov-fill2)] p-2.5 font-mono whitespace-nowrap"
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    color: i === 0 ? "var(--ov-faint)" : cell.color,
                    fontWeight: 700,
                    fontSize: i === 0 ? 10.5 : undefined,
                    letterSpacing: i === 0 ? "0.06em" : undefined,
                  }}
                >
                  {i === 0 ? total.name : cell.text}
                </td>
              )
            })}
          </tr>
          {sorted.map((row) => {
            const selected = scope.includes(row.name)
            return (
              <tr
                key={row.name}
                onClick={() => onScopeAction(selected && scope.length === 1 ? [] : [row.name])}
                className="cursor-pointer"
              >
                <td className="p-2.5 align-middle">
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleScopeAction(row.name)}
                    aria-label={`Tambahkan ${row.name} ke cakupan`}
                    className="h-3.5 w-3.5 accent-[var(--ov-blue)]"
                  />
                </td>
                {columns.map((col, i) => {
                  const cell = renderCell(row, col.key)
                  return (
                    <td
                      key={col.key}
                      className="rounded-md p-2.5 whitespace-nowrap hover:bg-[var(--ov-fill1)]"
                      style={{
                        textAlign: i === 0 ? "left" : "right",
                        background: selected ? "var(--accent)" : undefined,
                        color: cell.color,
                        fontFamily: i === 0 ? undefined : "var(--font-ibm-plex-mono)",
                        fontWeight: i === 0 ? 600 : undefined,
                      }}
                    >
                      {i === 0 ? row.name : cell.text}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
