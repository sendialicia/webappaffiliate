"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { TtProductRow } from "@/types/tiktok-pid"

type SortKey =
  | "name"
  | "gmv"
  | "growth"
  | "share"
  | "creators"
  | "livestream"
  | "video"
  | "productCard"
  | "orders"
  | "ttClicks"
  | "ttCoRate"
  | "itemsSold"
  | "commission"
  | "roi"
  | "ttImpressions"
  | "ttCtr"
  | "ttAddToCart"
  | "ttAtcRate"
  | "ttAvgDailyCustomers"
  | "ttContentCount"

const COLUMNS: Array<{ key: SortKey; label: string; group?: "pillar" | "tiktok" | "funnel" }> = [
  { key: "name", label: "Produk" },
  { key: "gmv", label: "GMV" },
  { key: "growth", label: "Growth" },
  { key: "share", label: "% Share" },
  { key: "creators", label: "Creators" },
  { key: "livestream", label: "Livestream", group: "pillar" },
  { key: "video", label: "Video", group: "pillar" },
  { key: "productCard", label: "Product Card", group: "pillar" },
  { key: "orders", label: "Orders", group: "tiktok" },
  { key: "ttClicks", label: "Clicks", group: "tiktok" },
  { key: "ttCoRate", label: "CO Rate (centre)", group: "tiktok" },
  { key: "itemsSold", label: "Items Sold", group: "tiktok" },
  { key: "commission", label: "Commission", group: "tiktok" },
  { key: "roi", label: "ROI", group: "tiktok" },
  { key: "ttImpressions", label: "Impressions", group: "funnel" },
  { key: "ttCtr", label: "CTR", group: "funnel" },
  { key: "ttAddToCart", label: "Add to Cart", group: "funnel" },
  { key: "ttAtcRate", label: "ATC → Order (centre)", group: "funnel" },
  { key: "ttAvgDailyCustomers", label: "Cust / hari", group: "funnel" },
  { key: "ttContentCount", label: "New Content", group: "funnel" },
]

function valueOf(row: TtProductRow, key: SortKey): number | string | null {
  if (key === "livestream") return row.pillars.livestream
  if (key === "video") return row.pillars.video
  if (key === "productCard") return row.pillars.productCard
  if (key === "name") return row.name
  return row[key]
}

function cellOf(row: TtProductRow, key: SortKey): { text: string; color?: string } {
  switch (key) {
    case "growth":
      return {
        text: formatSignedPercent(row.growth),
        color: (row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
    case "share":
      return { text: formatPercent(row.share, 2) }
    case "roi":
      return { text: row.roi !== null ? `${row.roi.toFixed(1)}x` : "—" }
    case "ttCoRate":
      return { text: row.ttCoRate !== null ? formatPercent(row.ttCoRate, 2) : "—" }
    case "ttCtr":
      return { text: row.ttCtr !== null ? formatPercent(row.ttCtr, 2) : "—" }
    case "ttAtcRate":
      return { text: row.ttAtcRate !== null ? formatPercent(row.ttAtcRate, 1) : "—" }
    case "ttAvgDailyCustomers":
      return { text: formatIdr(Math.round(row.ttAvgDailyCustomers)) }
    case "livestream":
    case "video":
    case "productCard":
      return { text: formatCompact(row.pillars[key]) }
    case "gmv":
    case "commission":
      return { text: formatCompact(row[key]) }
    default:
      return { text: formatIdr(Number(row[key] ?? 0)) }
  }
}

export function TtProductTable({
  rows,
  selectedPids,
  onSelectAction,
  onToggleAction,
  onSetSelectionAction,
  showPillars,
  showTiktok,
  showFunnel,
}: {
  rows: TtProductRow[]
  selectedPids: string[]
  /** Clicking a row opens that product on its own. */
  onSelectAction: (pid: string) => void
  /** The checkbox adds or removes a product from the combined selection. */
  onToggleAction: (pid: string) => void
  /** Replaces the whole selection, used by shift-range and the header checkbox. */
  onSetSelectionAction: (pids: string[]) => void
  showPillars: boolean
  showTiktok: boolean
  showFunnel: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)
  // Anchor for shift-range selection, tracked in displayed order.
  const [anchorPid, setAnchorPid] = useState<string | null>(null)

  const columns = COLUMNS.filter(
    (c) =>
      (c.group !== "pillar" || showPillars) &&
      (c.group !== "tiktok" || showTiktok) &&
      (c.group !== "funnel" || showFunnel),
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

  const visiblePids = sorted.map((r) => r.pid)
  const allSelected = visiblePids.length > 0 && visiblePids.every((p) => selectedPids.includes(p))
  const someSelected = visiblePids.some((p) => selectedPids.includes(p))

  const rangeFrom = (pid: string): string[] => {
    const end = visiblePids.indexOf(pid)
    const start = anchorPid ? visiblePids.indexOf(anchorPid) : -1
    if (start === -1 || end === -1) return [pid]
    const [lo, hi] = start <= end ? [start, end] : [end, start]
    return visiblePids.slice(lo, hi + 1)
  }

  const handleRowSelect = (pid: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (e.shiftKey && anchorPid) {
      const range = rangeFrom(pid)
      onSetSelectionAction([...new Set([...selectedPids, ...range])])
      return
    }
    if (e.metaKey || e.ctrlKey) {
      onToggleAction(pid)
      setAnchorPid(pid)
      return
    }
    onSelectAction(pid)
    setAnchorPid(pid)
  }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <div className="max-h-[440px] overflow-auto rounded-lg border border-[var(--ov-line)]">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 340 + columns.length * 88 }}>
        <thead>
          <tr>
            <th className="sticky top-0 z-[2] w-9 bg-[var(--card)] p-2.5 shadow-[inset_0_-2px_0_var(--ov-track)]">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected
                }}
                onChange={() => onSetSelectionAction(allSelected ? [] : visiblePids)}
                aria-label="Pilih semua produk yang tampil"
                title="Pilih semua produk yang tampil"
                className="h-3.5 w-3.5 accent-[var(--ov-blue)]"
              />
            </th>
            {columns.map((col, i) => (
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
          {sorted.map((row) => {
            const selected = selectedPids.includes(row.pid)
            return (
              <tr
                key={row.pid}
                onClick={(e) => handleRowSelect(row.pid, e)}
                className="cursor-pointer select-none hover:bg-[var(--ov-fill1)]"
                style={{ background: selected ? "var(--accent)" : undefined }}
              >
                <td className="border-b border-[var(--ov-fill1)] p-2.5 align-top">
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.shiftKey && anchorPid) {
                        e.preventDefault()
                        onSetSelectionAction([...new Set([...selectedPids, ...rangeFrom(row.pid)])])
                        return
                      }
                      setAnchorPid(row.pid)
                    }}
                    onChange={() => onToggleAction(row.pid)}
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
                            <span className="font-mono text-[12px] text-[var(--ov-faint)]">{row.pid}</span>
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
