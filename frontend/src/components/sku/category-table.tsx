"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { SkuCategoryRow } from "@/types/sku"

type SortKey =
  | "name"
  | "gmv"
  | "share"
  | "deltaRp"
  | "growth"
  | "shopeeShare"
  | "skus"
  | "crossMarketplaceSkus"
  | "itemsSold"
  | "orders"
  | "aov"
  | "creators"
  | "commission"
  | "spGmv"
  | "ttGmv"
  | "spItemsSold"
  | "ttItemsSold"
  | "spCreators"
  | "ttCreators"

const COLUMNS: Array<{ key: SortKey; label: string; group?: "split" | "detail"; mp?: "sp" | "tt" }> = [
  { key: "name", label: "Kategori" },
  { key: "gmv", label: "GMV" },
  { key: "share", label: "% Share" },
  { key: "deltaRp", label: "Δ Rp" },
  { key: "growth", label: "GMV Growth" },
  { key: "shopeeShare", label: "% SP" },
  { key: "spGmv", label: "GMV Shopee", group: "split", mp: "sp" },
  { key: "ttGmv", label: "GMV TikTok", group: "split", mp: "tt" },
  { key: "skus", label: "SKU" },
  { key: "crossMarketplaceSkus", label: "SKU di 2 MP" },
  { key: "itemsSold", label: "Items Sold" },
  { key: "spItemsSold", label: "Sold Shopee", group: "split", mp: "sp" },
  { key: "ttItemsSold", label: "Sold TikTok", group: "split", mp: "tt" },
  { key: "orders", label: "Orders", group: "detail" },
  { key: "aov", label: "AOV", group: "detail" },
  { key: "creators", label: "Creators", group: "detail" },
  { key: "spCreators", label: "Creators SP", group: "split", mp: "sp" },
  { key: "ttCreators", label: "Creators TT", group: "split", mp: "tt" },
  { key: "commission", label: "Commission", group: "detail" },
]

function valueOf(row: SkuCategoryRow, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return row.name
    case "spGmv":
      return row.shopee.gmv
    case "ttGmv":
      return row.tiktok.gmv
    case "spItemsSold":
      return row.shopee.itemsSold
    case "ttItemsSold":
      return row.tiktok.itemsSold
    case "spCreators":
      return row.shopee.creators
    case "ttCreators":
      return row.tiktok.creators
    default:
      return row[key]
  }
}

function renderCell(row: SkuCategoryRow, key: SortKey): { text: string; color?: string } {
  switch (key) {
    case "share":
      return { text: formatPercent(row.share) }
    case "shopeeShare":
      return { text: row.shopeeShare !== null ? formatPercent(row.shopeeShare, 1) : "—" }
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
    case "aov":
      return { text: row.aov !== null ? formatCompact(row.aov) : "—" }
    case "gmv":
    case "commission":
      return { text: formatIdr(row[key]) }
    case "spGmv":
      return { text: formatIdr(row.shopee.gmv) }
    case "ttGmv":
      return { text: formatIdr(row.tiktok.gmv) }
    default:
      return { text: formatIdr(Number(valueOf(row, key) ?? 0)) }
  }
}

export function SkuCategoryTable({
  total,
  rows,
  scope,
  onScopeAction,
  onToggleScopeAction,
  showSplit,
  showDetail,
}: {
  total: SkuCategoryRow
  rows: SkuCategoryRow[]
  scope: string[]
  /** Clicking a row makes it the only scope; the checkbox adds or removes one. */
  onScopeAction: (names: string[]) => void
  onToggleScopeAction: (name: string) => void
  showSplit: boolean
  showDetail: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

  const columns = COLUMNS.filter(
    (c) => (c.group !== "split" || showSplit) && (c.group !== "detail" || showDetail),
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

  const headTint = (mp?: "sp" | "tt") =>
    mp === "sp" ? "var(--ov-blue)" : mp === "tt" ? "var(--ov-gold)" : "var(--ov-head)"

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-separate border-spacing-0.5 text-[13px]"
        style={{ minWidth: 200 + columns.length * 92 }}
      >
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
                className="cursor-pointer rounded-md bg-[var(--accent)] p-2.5 text-[12px] font-bold tracking-wide whitespace-nowrap uppercase select-none"
                style={{ textAlign: i === 0 ? "left" : "right", color: headTint(col.mp) }}
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
