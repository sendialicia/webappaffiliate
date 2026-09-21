"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { SkuRow } from "@/types/sku"

type SortKey =
  | "name"
  | "gmv"
  | "growth"
  | "share"
  | "shopeeShare"
  | "itemsSold"
  | "orders"
  | "aov"
  | "creators"
  | "commission"
  | "pidCount"
  | "spGmv"
  | "ttGmv"
  | "spItemsSold"
  | "ttItemsSold"
  | "spOrders"
  | "ttOrders"
  | "spCreators"
  | "ttCreators"

/**
 * Paired columns: each marketplace keeps its own cell so the two can be read side by side,
 * with "% SP" as the one-glance summary of the split.
 */
const COLUMNS: Array<{ key: SortKey; label: string; group?: "split" | "detail"; mp?: "sp" | "tt" }> = [
  { key: "name", label: "SKU" },
  { key: "gmv", label: "GMV" },
  { key: "growth", label: "Growth" },
  { key: "shopeeShare", label: "% SP" },
  { key: "spGmv", label: "GMV Shopee", group: "split", mp: "sp" },
  { key: "ttGmv", label: "GMV TikTok", group: "split", mp: "tt" },
  { key: "itemsSold", label: "Items Sold" },
  { key: "spItemsSold", label: "Sold Shopee", group: "split", mp: "sp" },
  { key: "ttItemsSold", label: "Sold TikTok", group: "split", mp: "tt" },
  { key: "orders", label: "Orders", group: "detail" },
  { key: "spOrders", label: "Orders SP", group: "split", mp: "sp" },
  { key: "ttOrders", label: "Orders TT", group: "split", mp: "tt" },
  { key: "aov", label: "AOV", group: "detail" },
  { key: "creators", label: "Creators" },
  { key: "spCreators", label: "Creators SP", group: "split", mp: "sp" },
  { key: "ttCreators", label: "Creators TT", group: "split", mp: "tt" },
  { key: "commission", label: "Commission", group: "detail" },
  { key: "share", label: "% Share", group: "detail" },
  { key: "pidCount", label: "Listing", group: "detail" },
]

function valueOf(row: SkuRow, key: SortKey): number | string | null {
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
    case "spOrders":
      return row.shopee.orders
    case "ttOrders":
      return row.tiktok.orders
    case "spCreators":
      return row.shopee.creators
    case "ttCreators":
      return row.tiktok.creators
    default:
      return row[key]
  }
}

function cellOf(row: SkuRow, key: SortKey): { text: string; color?: string } {
  switch (key) {
    case "growth":
      return {
        text: formatSignedPercent(row.growth),
        color: (row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
    case "shopeeShare":
      return { text: row.shopeeShare !== null ? formatPercent(row.shopeeShare, 1) : "—" }
    case "share":
      return { text: formatPercent(row.share, 2) }
    case "aov":
      return { text: row.aov !== null ? formatCompact(row.aov) : "—" }
    case "gmv":
    case "commission":
      return { text: formatCompact(row[key]) }
    case "spGmv":
      return { text: formatCompact(row.shopee.gmv) }
    case "ttGmv":
      return { text: formatCompact(row.tiktok.gmv) }
    default: {
      const v = valueOf(row, key)
      return { text: formatIdr(Number(v ?? 0)) }
    }
  }
}

export function SkuProductTable({
  rows,
  selectedBarcodes,
  onSelectAction,
  onToggleAction,
  onSetSelectionAction,
  showSplit,
  showDetail,
}: {
  rows: SkuRow[]
  selectedBarcodes: string[]
  /** Clicking a row opens that SKU on its own. */
  onSelectAction: (barcode: string) => void
  /** The checkbox adds or removes a SKU from the combined selection. */
  onToggleAction: (barcode: string) => void
  /** Replaces the whole selection, used by shift-range and the header checkbox. */
  onSetSelectionAction: (barcodes: string[]) => void
  showSplit: boolean
  showDetail: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)
  // Anchor for shift-range selection, tracked in displayed order.
  const [anchor, setAnchor] = useState<string | null>(null)

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

  const visible = sorted.map((r) => r.barcode)
  const allSelected = visible.length > 0 && visible.every((b) => selectedBarcodes.includes(b))
  const someSelected = visible.some((b) => selectedBarcodes.includes(b))

  const rangeFrom = (barcode: string): string[] => {
    const end = visible.indexOf(barcode)
    const start = anchor ? visible.indexOf(anchor) : -1
    if (start === -1 || end === -1) return [barcode]
    const [lo, hi] = start <= end ? [start, end] : [end, start]
    return visible.slice(lo, hi + 1)
  }

  const handleRowSelect = (
    barcode: string,
    e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => {
    if (e.shiftKey && anchor) {
      onSetSelectionAction([...new Set([...selectedBarcodes, ...rangeFrom(barcode)])])
      return
    }
    if (e.metaKey || e.ctrlKey) {
      onToggleAction(barcode)
      setAnchor(barcode)
      return
    }
    onSelectAction(barcode)
    setAnchor(barcode)
  }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  const headTint = (mp?: "sp" | "tt") =>
    mp === "sp" ? "var(--ov-blue)" : mp === "tt" ? "var(--ov-gold)" : undefined

  return (
    <div className="max-h-[440px] overflow-auto rounded-lg border border-[var(--ov-line)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 360 + columns.length * 86 }}>
        <thead>
          <tr>
            <th className="sticky top-0 z-[2] w-9 bg-[var(--card)] p-2.5 shadow-[inset_0_-2px_0_var(--ov-track)]">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected
                }}
                onChange={() => onSetSelectionAction(allSelected ? [] : visible)}
                aria-label="Pilih semua SKU yang tampil"
                title="Pilih semua SKU yang tampil"
                className="h-3.5 w-3.5 accent-[var(--ov-blue)]"
              />
            </th>
            {columns.map((col, i) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="sticky top-0 z-[2] cursor-pointer bg-[var(--card)] p-2.5 text-[12px] font-bold tracking-wide whitespace-nowrap uppercase shadow-[inset_0_-2px_0_var(--ov-track)] select-none"
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  color: headTint(col.mp) ?? "var(--ov-head)",
                }}
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
          {sorted.map((row) => {
            const selected = selectedBarcodes.includes(row.barcode)
            return (
              <tr
                key={row.barcode}
                onClick={(e) => handleRowSelect(row.barcode, e)}
                className="cursor-pointer select-none hover:bg-[var(--ov-fill1)]"
                style={{ background: selected ? "var(--accent)" : undefined }}
              >
                <td className="border-b border-[var(--ov-fill1)] p-2.5 align-top">
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.shiftKey && anchor) {
                        e.preventDefault()
                        onSetSelectionAction([...new Set([...selectedBarcodes, ...rangeFrom(row.barcode)])])
                        return
                      }
                      setAnchor(row.barcode)
                    }}
                    onChange={() => onToggleAction(row.barcode)}
                    aria-label={`Gabungkan ${row.name}`}
                    title="Centang untuk menggabungkan · shift-klik untuk rentang"
                    className="mt-0.5 h-3.5 w-3.5 accent-[var(--ov-blue)]"
                  />
                </td>
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
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[12px] text-[var(--ov-faint)]">{row.barcode}</span>
                              {row.crossMarketplace && (
                                <span
                                  title="Terjual di Shopee dan TikTok pada periode ini"
                                  className="rounded bg-[var(--ov-fill2)] px-1 py-px text-[10.5px] font-bold tracking-wide text-[var(--ov-soft)] uppercase"
                                >
                                  SP+TT
                                </span>
                              )}
                              {row.isPaket && (
                                <span
                                  title="Tidak punya VARIANT_SAP_NAME — listing ini paket/bundle, namanya disusun dari variant + judul listing"
                                  className="rounded bg-[var(--ov-gold)]/20 px-1 py-px text-[10.5px] font-bold tracking-wide text-[var(--ov-gold-ink)] uppercase"
                                >
                                  paket
                                </span>
                              )}
                            </span>
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
          <div className="text-sm font-semibold">Tidak ada SKU yang cocok</div>
          <div className="mt-1.5 text-xs text-[var(--ov-faint)]">
            Coba ubah kata kunci pencarian atau lepas cakupan kategori.
          </div>
        </div>
      )}
    </div>
  )
}
