"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatIdr, formatPercent, formatRp } from "@/lib/format"
import type { CreatorDriverRow, CreatorDriversResult } from "@/types/overview"

/**
 * Which creators moved a slice: the top gainers and losers by GMV change, side by side, each
 * with its share of the slice's gross gains or losses. `slices` narrows the scope — one for a
 * composition row, two for a matrix cell (brand × format), none for the whole page.
 */
export function CreatorDrivers({
  query,
  slices,
  limit = 10,
}: {
  query: Record<string, string | undefined>
  slices: Array<{ field: string; value: string }>
  limit?: number
}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v) search.set(k, v)
  slices.forEach((s, i) => {
    search.set(`field${i + 1}`, s.field)
    search.set(`value${i + 1}`, s.value)
  })
  search.set("limit", String(limit))
  const url = `/api/overview/creator-drivers?${search.toString()}`

  const [state, setState] = useState<{ key: string; data?: CreatorDriversResult; error?: string } | null>(null)
  useEffect(() => {
    let stale = false
    apiFetch<CreatorDriversResult>(url)
      .then((data) => {
        if (!stale) setState({ key: url, data })
      })
      .catch((e) => {
        if (!stale) setState({ key: url, error: e instanceof Error ? e.message : "Gagal memuat creator" })
      })
    return () => {
      stale = true
    }
  }, [url])

  const current = state?.key === url ? state : null
  if (!current) return <DriversSkeleton />
  if (current.error) return <div className="text-[12.5px] text-[var(--ov-red-ink)]">{current.error}</div>
  const d = current.data!
  const agencyDelta = d.agencyGmv - d.agencyGmvPrev

  return (
    <div className="animate-in fade-in-0 duration-300">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DriverList
          title="Pendorong growth"
          tone="up"
          rows={d.gainers}
          base={d.grossGain}
          empty="Tidak ada creator yang GMV-nya naik."
        />
        <DriverList
          title="Penyebab loss"
          tone="down"
          rows={d.losers}
          base={d.grossLoss}
          empty="Tidak ada creator yang GMV-nya turun."
        />
      </div>
      <div className="mt-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
        Share = kontribusi creator terhadap total kenaikan (atau total penurunan) seluruh creator di slice ini, jadi
        yang teratas adalah yang paling menggerakkan angka.
        {(d.agencyGmv > 0 || d.agencyGmvPrev > 0) && (
          <>
            {" "}
            &ldquo;Agency&rdquo; (agregat, bukan satu creator) dilaporkan terpisah: {formatRp(d.agencyGmv)}, berubah{" "}
            {agencyDelta >= 0 ? "+" : "−"}
            {formatRp(Math.abs(agencyDelta)).replace("−", "")}.
          </>
        )}
      </div>
    </div>
  )
}

function DriverList({
  title,
  tone,
  rows,
  base,
  empty,
}: {
  title: string
  tone: "up" | "down"
  rows: CreatorDriverRow[]
  base: number
  empty: string
}) {
  const color = tone === "up" ? "var(--ov-green)" : "var(--ov-red)"
  const ink = tone === "up" ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <i className="block h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[13px] font-bold tracking-wider text-[var(--ov-head)] uppercase">{title}</span>
        <span className="ml-auto font-mono text-[12px] text-[var(--ov-faint)]">
          total {tone === "up" ? "+" : "−"}
          {formatIdr(Math.abs(base))}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12.5px] text-[var(--ov-faint)]">{empty}</div>
      ) : (
        rows.map((c, i) => (
          <div key={c.username} className="flex items-center gap-2 border-b border-[var(--ov-line)] py-1.5 text-[13px] last:border-b-0">
            <span className="w-5 text-right font-mono text-[var(--ov-faint)]">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ov-soft)]" title={c.username}>
              @{c.username}
            </span>
            {c.isManaged && (
              <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--accent-foreground)] uppercase">
                Managed
              </span>
            )}
            <span
              className="w-24 text-right font-mono font-semibold"
              style={{ color: ink }}
              title={`${formatIdr(c.gmvPrev)} → ${formatIdr(c.gmv)}`}
            >
              {c.delta >= 0 ? "+" : "−"}
              {formatRp(Math.abs(c.delta)).replace("−", "")}
            </span>
            <span className="flex w-20 items-center gap-1.5">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ov-track)]">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(c.share * 100, 100)}%`, background: color }} />
              </span>
              <span className="w-9 text-right font-mono text-[11.5px] text-[var(--ov-faint)]">{formatPercent(c.share, 0)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/** Placeholder rows while the lists load, so the panel opens at its final height. */
function DriversSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((col) => (
        <div key={col} className="flex flex-col gap-2">
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--ov-fill1)]" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-[var(--ov-fill1)]" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ))}
    </div>
  )
}
