"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { CompositionResult, CompositionRow, TopCreatorsResult } from "@/types/overview"

const TOP_N = 10

export function CompositionDetail({
  row,
  result,
  color,
  query,
  onCloseAction,
}: {
  row: CompositionRow
  result: CompositionResult
  color: string
  /** The page's active filters, so the creator list covers exactly what the row shows. */
  query: Record<string, string | undefined>
  onCloseAction: () => void
}) {
  const shareOfChange = result.totals.delta !== 0 ? row.delta / result.totals.delta : null

  const search = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...query, dimension: result.dimension, value: row.name, limit: String(TOP_N) })) {
    if (v) search.set(k, v)
  }
  const url = `/api/overview/top-creators?${search.toString()}`
  const [creators, setCreators] = useState<{ key: string; data?: TopCreatorsResult; error?: string } | null>(null)

  useEffect(() => {
    let stale = false
    apiFetch<TopCreatorsResult>(url)
      .then((data) => {
        if (!stale) setCreators({ key: url, data })
      })
      .catch((e) => {
        if (!stale) setCreators({ key: url, error: e instanceof Error ? e.message : "Gagal memuat creator" })
      })
    return () => {
      stale = true
    }
  }, [url])

  const current = creators?.key === url ? creators : null
  const top = current?.data

  return (
    <div
      className="mt-3.5 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-fill1)] p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="text-base font-semibold font-(family-name:--font-archivo)">{row.name}</div>
        <div className="flex-1 text-xs text-[var(--ov-faint)]">
          {shareOfChange !== null ? `${formatPercent(shareOfChange, 0)} dari total perubahan GMV` : "—"} ·{" "}
          {row.delta >= 0 ? "+" : "−"}
          {formatIdr(Math.abs(row.delta))}
        </div>
        <button
          type="button"
          onClick={onCloseAction}
          className="rounded-md border border-[var(--ov-line)] px-2 py-1 text-xs text-[var(--ov-faint)] hover:text-[var(--ov-soft)]"
        >
          Tutup ✕
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DetailTile label="GMV" value={formatIdr(row.gmv)} sub={formatSignedPercent(row.growth)} subColor={(row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"} />
        <DetailTile label="Share GMV" value={formatPercent(row.share)} sub="dari total afiliasi" />
        <DetailTile
          label="Creators"
          value={formatIdr(row.creators)}
          sub={`${formatSignedPercent(row.creatorsGrowth)} dari ${formatIdr(row.creatorsPrev)}`}
          subColor={(row.creatorsGrowth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"}
        />
        <DetailTile
          label="GMV per creator"
          value={formatIdr(row.gmvPerCreator)}
          sub={`dari ${formatIdr(row.gmvPerCreatorPrev)}`}
        />
      </div>

      {/* Who carries this slice: the top creators and how concentrated the slice is. */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
            Top {TOP_N} creator
          </span>
          {top && top.topShare !== null && (
            <span className="text-[12.5px] text-[var(--ov-faint)]">
              {TOP_N} teratas menguasai{" "}
              <span className="font-semibold text-[var(--ov-soft)]">{formatPercent(top.topShare)}</span> GMV creator
              {top.topSharePrev !== null && <> (sebelumnya {formatPercent(top.topSharePrev)})</>}
            </span>
          )}
        </div>
        {!current ? (
          <div className="mt-2 text-[12.5px] text-[var(--ov-faint)]">Memuat creator…</div>
        ) : current.error ? (
          <div className="mt-2 text-[12.5px] text-[var(--ov-red-ink)]">{current.error}</div>
        ) : top && top.rows.length === 0 ? (
          <div className="mt-2 text-[12.5px] text-[var(--ov-faint)]">Tidak ada creator pada slice ini.</div>
        ) : top ? (
          <>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
              {top.rows.map((c, i) => (
                <div key={c.username} className="flex items-center gap-2 py-1 text-[13px]">
                  <span className="w-5 text-right font-mono text-[var(--ov-faint)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ov-soft)]" title={c.username}>
                    @{c.username}
                  </span>
                  {c.isManaged && (
                    <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-foreground)] uppercase">
                      Managed
                    </span>
                  )}
                  <span className="w-28 text-right font-mono text-[var(--ov-ink)]">{formatIdr(c.gmv)}</span>
                  <span className="flex w-24 items-center gap-1.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ov-track)]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(c.share * 100 * 4, 100)}%`, background: color }} />
                    </span>
                    <span className="w-11 text-right font-mono text-[12px] text-[var(--ov-faint)]">{formatPercent(c.share)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
              Share = GMV creator ÷ GMV {row.name}.
              {top.agencyGmv > 0 && (
                <>
                  {" "}
                  &ldquo;Agency&rdquo; ({formatPercent(top.total > 0 ? top.agencyGmv / top.total : 0)} dari GMV slice ini) adalah
                  agregat penjualan agency, bukan satu creator, jadi tidak masuk daftar dan tidak dihitung dalam konsentrasi.
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function DetailTile({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string
  sub: string
  subColor?: string
}) {
  return (
    <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--card)] px-3 py-2.5">
      <div className="text-[12px] tracking-wider text-[var(--ov-faint)] uppercase">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-[12.5px]" style={{ color: subColor ?? "var(--ov-faint)" }}>
        {sub}
      </div>
    </div>
  )
}
