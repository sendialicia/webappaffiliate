"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { apiFetch } from "@/lib/api"
import { formatCompact, formatIdr, formatPercent, formatRpFull } from "@/lib/format"
import type { CreatorDetail } from "@/types/creator-detail"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

const PILLAR_KEYS = [
  { key: "livestream", label: "Livestream", color: "var(--ov-gold)" },
  { key: "video", label: "Video", color: "var(--ov-blue)" },
  { key: "productCard", label: "Product Card", color: "var(--chart-5)" },
] as const

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">{label}</div>
      <div className="mt-1 font-mono text-[15px] font-semibold">{value}</div>
      {note && <div className="mt-0.5 text-[12px] text-[var(--ov-faint)]">{note}</div>}
    </div>
  )
}

/**
 * Opens on a creator row and fetches only then, so the table itself stays cheap. Everything
 * inside comes from the same order table the page already reads — nothing here needs a source
 * the warehouse does not have.
 */
export function CreatorDetailModal({
  endpoint,
  username,
  query,
  onCloseAction,
}: {
  endpoint: string
  /** Null closes the dialog. */
  username: string | null
  query: Record<string, string | undefined>
  onCloseAction: () => void
}) {
  // One state keyed by the request URL, so a stale response can never paint over a newer one
  // and nothing has to be reset synchronously inside the effect.
  const [result, setResult] = useState<{ key: string; value?: CreatorDetail; error?: string } | null>(null)

  const url = username
    ? (() => {
        const search = new URLSearchParams()
        search.set("username", username)
        for (const [k, v] of Object.entries(query)) if (v) search.set(k, v)
        return `${endpoint}?${search.toString()}`
      })()
    : null

  useEffect(() => {
    if (!url) return
    apiFetch<CreatorDetail>(url)
      .then((value) => setResult({ key: url, value }))
      .catch((e) =>
        setResult({ key: url, error: e instanceof Error ? e.message : "Gagal memuat detail creator" }),
      )
  }, [url])

  useEffect(() => {
    if (!username) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [username, onCloseAction])

  if (!username) return null
  const current = result?.key === url ? result : null
  const d = current?.value ?? null
  const error = current?.error ?? null
  const pillarSum = d ? d.pillars.livestream + d.pillars.video + d.pillars.productCard : 0
  // TikTok leaves ~15% of GMV with no PILLAR at all. Normalising on the three named pillars
  // would quietly inflate each share, so the remainder gets its own segment instead.
  const unpillared = d ? Math.max(d.gmv - pillarSum, 0) : 0
  const pillarTotal = pillarSum + unpillared

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail creator ${username}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseAction()
      }}
    >
      <div
        className="w-full max-w-[860px] rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]"
        style={{ background: "var(--ov-card-gradient)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[18px] font-semibold font-(family-name:--font-archivo)">@{username}</span>
          {d && (
            <span
              className="rounded px-1.5 py-0.5 text-[11.5px] font-bold tracking-wide uppercase"
              style={{
                background: d.isManaged ? "var(--accent)" : "var(--ov-fill1)",
                color: d.isManaged ? "var(--accent-foreground)" : "var(--ov-faint)",
              }}
            >
              {d.isManaged ? "Managed" : "Organic"}
            </span>
          )}
          <button
            type="button"
            onClick={onCloseAction}
            aria-label="Tutup"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ov-line)] text-[var(--ov-faint)] hover:bg-[var(--ov-fill1)] hover:text-[var(--ov-ink)]"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-3 py-2 text-xs text-[var(--ov-red-ink)]">
            {error}
          </div>
        )}

        {!d && !error && (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--ov-faint)]">
            Memuat detail creator…
          </div>
        )}

        {d && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--ov-line)] pt-4 sm:grid-cols-4">
              <Stat label="GMV" value={formatRpFull(d.gmv)} note={`${formatIdr(d.orders)} order`} />
              <Stat
                label="AOV"
                value={d.aov !== null ? formatRpFull(d.aov) : "—"}
                note={`${formatIdr(d.itemsSold)} item terjual`}
              />
              <Stat
                label="Peringkat"
                value={`#${formatIdr(d.rank)}`}
                note={`dari ${formatIdr(d.totalCreators)} creator · persentil ${formatPercent(d.percentile, 1)}`}
              />
              <Stat
                label="Aktivitas"
                value={`${formatIdr(d.activeDays)} hari`}
                note={`${formatIdr(d.productCount)} produk · komisi ${formatCompact(d.commission)}`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 border-t border-[var(--ov-line)] pt-4 lg:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-[var(--ov-mut)]">Cara dia jualan</div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[var(--ov-track)]">
                  {PILLAR_KEYS.map((p) => (
                    <span
                      key={p.key}
                      title={`${p.label} ${formatCompact(d.pillars[p.key])}`}
                      style={{
                        width: `${pillarTotal > 0 ? (d.pillars[p.key] / pillarTotal) * 100 : 0}%`,
                        background: p.color,
                      }}
                    />
                  ))}
                  {unpillared > 0 && (
                    <span
                      title={`Tanpa pillar ${formatCompact(unpillared)}`}
                      style={{ width: `${(unpillared / pillarTotal) * 100}%`, background: "var(--ov-dim)" }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                  {PILLAR_KEYS.map((p) => (
                    <span key={p.key} className="flex items-center gap-1.5">
                      <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                      <span className="text-[var(--ov-soft)]">{p.label}</span>
                      <span className="font-mono text-[var(--ov-mut)]">
                        {pillarTotal > 0 ? formatPercent(d.pillars[p.key] / pillarTotal) : "—"}
                      </span>
                    </span>
                  ))}
                  {unpillared > 0 && (
                    <span className="flex items-center gap-1.5">
                      <i className="block h-2.5 w-2.5 rounded-sm bg-[var(--ov-dim)]" />
                      <span className="text-[var(--ov-soft)]">Tanpa pillar</span>
                      <span className="font-mono text-[var(--ov-mut)]">
                        {formatPercent(unpillared / pillarTotal)}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-4 text-sm font-semibold text-[var(--ov-mut)]">GMV harian</div>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={d.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="bucket"
                      tick={{ fill: "var(--ov-faint)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCompact(Number(v))}
                      tick={{ fill: "var(--ov-faint)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip {...TOOLTIP_PLACEMENT}
                      contentStyle={{
                        background: "var(--ov-tooltip)",
                        border: "1px solid var(--ov-line)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--ov-head)" }}
                      formatter={(v) => [formatIdr(Number(v)), "GMV"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="gmv"
                      stroke="var(--ov-gold)"
                      fill="var(--ov-gold)"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="mt-3 border-t border-[var(--ov-line)] pt-3 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
                  Jangkauan: <span className="font-semibold text-[var(--ov-soft)]">{d.brands.length} brand</span> ·{" "}
                  {d.categoryCount} kategori · {d.subCategoryCount} sub-kategori ·{" "}
                  {d.marketplaces.join(" + ") || "—"}
                  <div className="mt-1">{d.brands.join(", ")}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-[var(--ov-mut)]">Produk terlaris dia</div>
                <div className="mt-0.5 mb-2 text-[12.5px] text-[var(--ov-faint)]">
                  Share dihitung terhadap GMV creator ini, bukan GMV produknya.
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {d.topProducts.map((t) => (
                    <div key={t.id} className="mb-2">
                      <div className="flex items-baseline gap-2 text-[12.5px]">
                        <span className="min-w-0 flex-1 truncate text-[var(--ov-soft)]" title={t.name}>
                          {t.name}
                        </span>
                        <span className="font-mono font-semibold">{formatPercent(t.share, 1)}</span>
                        <span className="w-16 text-right font-mono text-[var(--ov-faint)]">
                          {formatCompact(t.gmv)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--ov-track)]">
                        <span
                          className="block h-full bg-[var(--ov-gold)]"
                          style={{ width: `${Math.min(t.share * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {d.topProducts.length === 0 && (
                    <div className="text-[13px] text-[var(--ov-faint)]">Tidak ada produk pada cakupan ini.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
