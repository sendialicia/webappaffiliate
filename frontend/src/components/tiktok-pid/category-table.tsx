"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { TtCategoryRow } from "@/types/tiktok-pid"

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
  | "ttVideos"
  | "ttLiveStreams"

/**
 * Three toggle groups rather than Shopee's two: TikTok reports a full impression-to-cart funnel
 * plus content counts, which would otherwise make the default view unreadably wide.
 */
const COLUMNS: Array<{ key: SortKey; label: string; group?: "pillar" | "tiktok" | "funnel" }> = [
  { key: "name", label: "Kategori" },
  { key: "gmv", label: "GMV" },
  { key: "share", label: "% Share" },
  { key: "deltaRp", label: "Δ Rp" },
  { key: "growth", label: "GMV Growth" },
  { key: "livestream", label: "GMV Livestream", group: "pillar" },
  { key: "video", label: "GMV Video", group: "pillar" },
  { key: "productCard", label: "GMV Product Card", group: "pillar" },
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
  { key: "ttAvgDailyCustomers", label: "Customers / hari", group: "funnel" },
  { key: "ttVideos", label: "New Videos", group: "funnel" },
  { key: "ttLiveStreams", label: "New Live Streams", group: "funnel" },
]

function valueOf(row: TtCategoryRow, key: SortKey): number | string | null {
  if (key === "livestream") return row.pillars.livestream
  if (key === "video") return row.pillars.video
  if (key === "productCard") return row.pillars.productCard
  if (key === "name") return row.name
  return row[key]
}

function renderCell(row: TtCategoryRow, key: SortKey): { text: string; color?: string; title?: string } {
  switch (key) {
    case "share":
      return { text: formatPercent(row.share) }
    case "growth":
      return {
        text: formatSignedPercent(row.growth),
        color: (row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
    case "deltaRp":
      return {
        text: `${row.deltaRp >= 0 ? "+" : "−"}${formatCompact(Math.abs(row.deltaRp))}`,
        title: `${row.deltaRp >= 0 ? "+" : "−"}${formatIdr(Math.abs(row.deltaRp))}`,
        color: row.deltaRp >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
      }
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
      return { text: formatCompact(row.pillars[key]), title: formatIdr(row.pillars[key]) }
    case "gmv":
    case "commission":
      return { text: formatIdr(row[key]) }
    default:
      return { text: formatIdr(Number(row[key] ?? 0)) }
  }
}

export function TtCategoryTable({
  total,
  rows,
  scope,
  onScopeAction,
  onToggleScopeAction,
  showPillars,
  showTiktok,
  showFunnel,
}: {
  total: TtCategoryRow
  rows: TtCategoryRow[]
  scope: string[]
  /** Clicking a row makes it the only scope; the checkbox adds or removes one. */
  onScopeAction: (names: string[]) => void
  onToggleScopeAction: (name: string) => void
  showPillars: boolean
  showTiktok: boolean
  showFunnel: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

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

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    // Format level runs to ~60 rows: the table scrolls inside its card with the header pinned.
    <div className="max-h-[520px] overflow-auto">
      <table
        className="w-full border-separate border-spacing-0.5 text-[13px]"
        style={{ minWidth: 220 + columns.length * 92 }}
      >
        {/* Solid card colour under the translucent header cells, so rows do not show through. */}
        <thead className="sticky top-0 z-[2]" style={{ background: "var(--card)" }}>
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
                  {i === 0 ? total.name : cell.title ? <span title={cell.title}>{cell.text}</span> : cell.text}
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
                      {i === 0 ? row.name : cell.title ? <span title={cell.title}>{cell.text}</span> : cell.text}
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
