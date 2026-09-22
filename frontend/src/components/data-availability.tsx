"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { apiFetch, isSnapshot } from "@/lib/api"
import type { DataAvailabilityResult, DataAvailabilityRow } from "@/types/overview"

type Column = keyof Omit<DataAvailabilityRow, "brand">

const COLUMNS: Array<{ key: Column; label: string; group: string }> = [
  { key: "shopeeOrders", label: "Shopee", group: "Order" },
  { key: "tiktokOrders", label: "TikTok", group: "Order" },
  { key: "shopeeActual", label: "Shopee", group: "Achievement" },
  { key: "tiktokActual", label: "TikTok", group: "Achievement" },
  { key: "tiktokContent", label: "TikTok", group: "Konten" },
]

/**
 * What each source feeds, so a red date reads as "this part of the dashboard is short on its
 * last days" rather than as a bare table cell. Section ids are the Overview's anchors.
 */
const SOURCES: Array<{ group: string; what: string; sections: Array<{ label: string; id?: string }> }> = [
  {
    group: "Order",
    what: "transaksi affiliate (GMV, order, creator, komisi)",
    sections: [
      { label: "Summary", id: "ov-sec-4" },
      { label: "Komposisi GMV", id: "ov-sec-5" },
      { label: "Format per brand", id: "ov-sec-6" },
      { label: "Affiliate's health", id: "ov-sec-8" },
      { label: "Spend & akuisisi", id: "ov-sec-9" },
      { label: "halaman Shopee PID, TikTok PID, SKU" },
    ],
  },
  {
    group: "Achievement",
    what: "GMV aktual vs target pool",
    sections: [
      { label: "Performa tahun ini", id: "ov-sec-1" },
      { label: "Daily achievement", id: "ov-sec-2" },
      { label: "Progress bar & proyeksi akhir bulan", id: "ov-sec-3" },
    ],
  },
  {
    group: "Konten",
    what: "konten baru & GMV per pillar TikTok",
    sections: [{ label: "Conversion funnel", id: "ov-sec-7" }],
  },
]

/** More than this many days behind its own source's freshest brand reads as lagging. */
const LAG_DAYS = 2

function short(iso: string | null): string {
  if (!iso) return "—"
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000)
}

/**
 * "Data up to" chip for the page header. Loads stop at different days per brand and per
 * source, so hovering lists every brand's last day for orders, achievement and content, and
 * marks the ones lagging behind the rest of their source — the reason a brand's recent days
 * can read low before anyone has to ask.
 */
export function DataAvailability() {
  const [data, setData] = useState<DataAvailabilityResult | null>(null)
  // Section names jump to their block, but only where those blocks are: on the Overview.
  const onOverview = usePathname() === "/overview"

  useEffect(() => {
    if (isSnapshot) return
    let stale = false
    apiFetch<DataAvailabilityResult>("/api/overview/data-availability")
      .then((result) => {
        if (!stale) setData(result)
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [])

  if (!data || !data.latest) return null

  // Lag is judged per source: content always trails orders, so comparing it with orders would
  // flag every brand and mean nothing.
  const freshest = Object.fromEntries(
    COLUMNS.map((c) => [c.key, data.rows.reduce<string | null>((acc, r) => (r[c.key] && (!acc || r[c.key]! > acc) ? r[c.key] : acc), null)]),
  ) as Record<Column, string | null>
  const lagging = (key: Column, value: string | null) => {
    const top = freshest[key]
    return value !== null && top !== null && daysBetween(value, top) > LAG_DAYS
  }
  const laggingCount = data.rows.filter((r) => COLUMNS.some((c) => lagging(c.key, r[c.key]))).length

  return (
    <div className="group relative">
      <div
        className="flex h-8 cursor-help items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-3 text-xs font-semibold text-[var(--ov-soft)]"
        tabIndex={0}
      >
        <i
          className="block h-2 w-2 rounded-full"
          style={{ background: laggingCount > 0 ? "var(--ov-gold)" : "var(--ov-green)" }}
        />
        Data s/d {short(data.latest)}
        {laggingCount > 0 && <span className="text-[var(--ov-gold-ink)]">· {laggingCount} brand tertinggal</span>}
      </div>

      <div className="absolute top-full right-0 z-50 hidden pt-2 group-focus-within:block group-hover:block">
        <div
          className="w-[600px] max-w-[calc(100vw-32px)] rounded-xl border p-3 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
        >
          <div className="mb-2 text-[12.5px] font-bold text-[var(--ov-head)]">Data terakhir per brand</div>
          <div className="mb-2.5 flex flex-col gap-1 rounded-lg bg-[var(--ov-fill1)] px-2.5 py-2 text-[12px] leading-relaxed text-[var(--ov-soft)]">
            {SOURCES.map((src) => (
              <div key={src.group}>
                <span className="font-bold text-[var(--ov-head)]">{src.group}</span>{" "}
                <span className="text-[var(--ov-faint)]">({src.what}) → dipakai di</span>{" "}
                {src.sections.map((sec, i) => (
                  <span key={sec.label}>
                    {i > 0 && ", "}
                    {onOverview && sec.id ? (
                      <a href={`#${sec.id}`} className="underline decoration-dotted underline-offset-2 hover:text-[var(--ov-ink)]">
                        {sec.label}
                      </a>
                    ) : (
                      sec.label
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[11.5px] tracking-wide text-[var(--ov-faint)] uppercase">
                  <th className="pb-1 text-left font-bold" rowSpan={2}>
                    Brand
                  </th>
                  <th className="pb-0.5 text-center font-bold" colSpan={2}>
                    Order
                  </th>
                  <th className="pb-0.5 text-center font-bold" colSpan={2}>
                    Achievement
                  </th>
                  <th className="pb-0.5 text-center font-bold">Konten</th>
                </tr>
                <tr className="text-[11.5px] text-[var(--ov-faint)]">
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="pb-1 text-right font-semibold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.brand}>
                    <td className="border-t border-[var(--ov-line)] py-1 pr-2 font-semibold text-[var(--ov-soft)]">
                      {r.brand}
                    </td>
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className="border-t border-[var(--ov-line)] py-1 pl-2 text-right font-mono"
                        style={{ color: lagging(c.key, r[c.key]) ? "var(--ov-red-ink)" : r[c.key] ? "var(--ov-ink)" : "var(--ov-dim)" }}
                      >
                        {short(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 border-t border-[var(--ov-line)] pt-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
            Merah = tertinggal lebih dari {LAG_DAYS} hari dari brand terbaru di sumber yang sama. Artinya bagian yang
            memakai sumber itu (lihat daftar di atas) belum memuat hari-hari terakhir brand tersebut, jadi angkanya bisa
            terbaca lebih rendah dari kenyataan. Contoh: Konten Kahf merah → Conversion funnel Kahf belum mencakup
            konten setelah tanggal itu.
          </div>
        </div>
      </div>
    </div>
  )
}
