"use client"

import { useState } from "react"
import { formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { CompositionRow } from "@/types/overview"

type SortKey = "name" | "gmv" | "share" | "growth" | "creators" | "creatorsPrev" | "creatorsGrowth"

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "name", label: "Kategori", align: "left" },
  { key: "gmv", label: "GMV", align: "right" },
  { key: "share", label: "% Share", align: "right" },
  { key: "growth", label: "Growth", align: "right" },
  { key: "creators", label: "Creators", align: "right" },
  { key: "creatorsPrev", label: "Creators prev", align: "right" },
  { key: "creatorsGrowth", label: "CC Growth", align: "right" },
]

export const DIMENSION_COLORS = [
  "#f2c14e",
  "#4aa3e0",
  "#ef5f7a",
  "#2ec27e",
  "#bdb5ff",
  "#8fe0d6",
  "#f6c391",
  "#7aa2d0",
  "#c98fe0",
  "#e08f8f",
  "#8fe0a8",
  "#e0d68f",
]

export function CompositionTable({
  rows,
  selected,
  onSelectAction,
}: {
  rows: CompositionRow[]
  selected: string | null
  onSelectAction: (name: string | null) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>("gmv")
  const [asc, setAsc] = useState(false)

  const colorByName = new Map(rows.map((r, i) => [r.name, DIMENSION_COLORS[i % DIMENSION_COLORS.length]]))

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
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
      <table className="w-full min-w-[620px] border-collapse text-[13px]">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                title="Klik untuk mengurutkan"
                className="cursor-pointer border-b border-[var(--ov-line)] bg-[var(--accent)] p-2.5 text-[12px] font-bold tracking-wider whitespace-nowrap text-[var(--ov-head)] uppercase select-none"
                style={{ textAlign: col.align }}
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
            const isSelected = selected === row.name
            return (
              <tr
                key={row.name}
                onClick={() => onSelectAction(isSelected ? null : row.name)}
                className="cursor-pointer hover:bg-[var(--ov-fill1)]"
                style={{ background: isSelected ? "var(--accent)" : undefined }}
              >
                <td className="border-b border-[var(--ov-line)] p-2.5 font-semibold">
                  <span className="flex items-center gap-2">
                    <i
                      className="block h-2.5 w-2.5 flex-none rounded-sm"
                      style={{ background: colorByName.get(row.name) }}
                    />
                    {row.name}
                  </span>
                </td>
                <td className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                  {formatIdr(row.gmv)}
                </td>
                <td className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono font-semibold">
                  {formatPercent(row.share)}
                </td>
                <td
                  className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono font-semibold"
                  style={{ color: (row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
                >
                  {formatSignedPercent(row.growth)}
                </td>
                <td className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                  {formatIdr(row.creators)}
                </td>
                <td className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                  {formatIdr(row.creatorsPrev)}
                </td>
                <td
                  className="border-b border-[var(--ov-line)] p-2.5 text-right font-mono font-semibold"
                  style={{ color: (row.creatorsGrowth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
                >
                  {formatSignedPercent(row.creatorsGrowth)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
