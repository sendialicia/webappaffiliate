"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api"
import { formatIdr } from "@/lib/format"
import type { OpportunityCreatorsResult } from "@/types/shopee-pid"

const PILLARS = ["Livestream", "Video", "Product Card"]
const ALL = "__all__"

/**
 * What counts as a "comparable" product. Deliberately independent of the level selector in the
 * filter bar: that one decides how the table above is grouped, this one decides how wide to cast
 * the net. Sub-kategori is the default because it is the only tier with a usable number of values
 * — kategori has 4-5, so half the catalogue becomes a peer, and format has 63, so almost nothing does.
 */
const LEVELS = [
  { value: "category", noun: "kategori" },
  { value: "subcategory", noun: "sub-kategori" },
  { value: "format", noun: "format" },
] as const

type OppLevel = (typeof LEVELS)[number]["value"]

const nounOf = (v: OppLevel) => LEVELS.find((l) => l.value === v)!.noun

/**
 * Loads on demand rather than with the page: the "never touched this product" test looks back
 * six months, and on a table with no sorting key that is close to a full scan. Keeping it behind
 * a button means the deep dive stays fast and only a reader who wants this pays for it.
 *
 * Shared by all three product pages — only the endpoint and the id parameter differ.
 */
export function OpportunityCreators({
  endpoint,
  idParam,
  ids,
  query,
  onLoadedAction,
}: {
  /** e.g. "/api/sku/opportunity-creators" */
  endpoint: string
  /** "pid" on the PID pages, "barcode" on SKU. */
  idParam: string
  /** Comma-joined selection; empty disables the panel. */
  ids: string
  /** Period and dimension filters, already serialised. */
  query: Record<string, string | undefined>
  /** Hands the loaded list to the page, so the download menu can offer it. */
  onLoadedAction?: (ids: string, data: OpportunityCreatorsResult) => void
}) {
  const [pillar, setPillar] = useState<string>(ALL)
  const [level, setLevel] = useState<OppLevel>("subcategory")
  // The result label follows the request the rows came from, not the dropdown's current value.
  const [freshLevel, setFreshLevel] = useState<OppLevel>("subcategory")
  const [state, setState] = useState<{ key: string; data: OpportunityCreatorsResult } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const url = ids
    ? (() => {
        const search = new URLSearchParams()
        search.set(idParam, ids)
        for (const [k, v] of Object.entries(query)) if (v) search.set(k, v)
        if (pillar !== ALL) search.set("oppPillar", pillar)
        search.set("oppLevel", level)
        return `${endpoint}?${search.toString()}`
      })()
    : null

  const load = () => {
    if (!url) return
    setLoading(true)
    setError(null)
    apiFetch<OpportunityCreatorsResult>(url)
      .then((data) => {
        setState({ key: url, data })
        setFreshLevel(level)
        onLoadedAction?.(ids, data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat creator peluang"))
      .finally(() => setLoading(false))
  }

  // Keyed on the request URL, so changing the pillar, the basis or the product invalidates the view
  // instead of showing last request's rows under the new label.
  const fresh = state?.key === url ? state.data : null
  const noun = fresh ? nounOf(freshLevel) : nounOf(level)

  return (
    <div
      className="rounded-xl border border-[var(--ov-line)] p-5 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
      style={{ background: "var(--ov-card-gradient)" }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--ov-gold)" }} />
        <span className="text-[15px] font-semibold font-(family-name:--font-archivo)">Creator peluang</span>
        {fresh && (
          <span className="rounded-full border border-[var(--ov-line)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--ov-soft)]">
            {fresh.subCategory}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={level} onValueChange={(v) => v && setLevel(v as OppLevel)}>
            <SelectTrigger
              className="h-7 w-36 bg-[var(--input)] text-xs"
              title="Seberapa mirip sebuah produk harus dengan produk ini supaya creator-nya ikut dihitung"
            >
              <SelectValue>
                {(v: string) => `Se-${nounOf((v || "subcategory") as OppLevel)}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  Se-{l.noun}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pillar} onValueChange={(v) => v && setPillar(v)}>
            <SelectTrigger className="h-7 w-36 bg-[var(--input)] text-xs">
              <SelectValue>{(v: string) => (v === ALL || !v ? "Semua pillar" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua pillar</SelectItem>
              {PILLARS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={load}
            disabled={!ids || loading}
            className="flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold whitespace-nowrap disabled:opacity-45"
            style={{
              borderColor: ids ? "var(--accent-foreground)" : "var(--ov-line)",
              background: ids ? "var(--accent)" : "transparent",
              color: ids ? "var(--accent-foreground)" : "var(--ov-mut)",
            }}
          >
            {loading ? "Mencari…" : fresh ? "Muat ulang" : "Cari"}
          </button>
        </div>
      </div>

      <div className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
        {!ids
          ? "Pilih satu produk di tabel atas dulu."
          : fresh
            ? `Creator yang menjual produk lain di ${noun} ${fresh.subCategory} pada periode ini, tapi belum pernah menyentuh produk ini selama ${fresh.lookbackDays} hari terakhir. Minimal 2 produk se-${noun}, MANAGED lebih dulu.`
            : "Dimuat saat diminta — pencariannya menengok 6 bulan ke belakang, jadi butuh beberapa detik."}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-3 py-2 text-xs text-[var(--ov-red-ink)]">
          {error}
        </div>
      )}

      {fresh && fresh.rows.length === 0 && (
        <div className="mt-4 text-[13px] text-[var(--ov-faint)]">
          Tidak ada creator yang memenuhi syarat
          {pillar !== ALL ? ` dengan pillar dominan ${pillar}` : ""}.
        </div>
      )}

      {fresh && fresh.rows.length > 0 && (
        <>
          <div className="mt-3 max-h-[300px] overflow-auto rounded-lg border border-[var(--ov-line)]">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    ["Creator", "left"],
                    ["Brand yang dijual", "left"],
                    [`Produk se-${noun}`, "right"],
                    [`GMV di ${noun}`, "right"],
                    ["Estimasi peluang", "right"],
                    ["Pillar dominan", "left"],
                  ].map(([h, align]) => (
                    <th
                      key={h}
                      className="sticky top-0 z-[2] bg-[var(--card)] p-2.5 text-[12px] font-bold tracking-wide whitespace-nowrap text-[var(--ov-head)] uppercase shadow-[inset_0_-2px_0_var(--ov-track)]"
                      style={{ textAlign: align as "left" | "right" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fresh.rows.map((r) => (
                  <tr key={r.username} className="hover:bg-[var(--ov-fill1)]">
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 font-semibold">
                      <span className="flex flex-wrap items-center gap-2">
                        @{r.username}
                        <span
                          className="rounded px-1.5 py-0.5 text-[11.5px] font-bold tracking-wide uppercase"
                          style={{
                            background: r.isManaged ? "var(--accent)" : "var(--ov-fill1)",
                            color: r.isManaged ? "var(--accent-foreground)" : "var(--ov-faint)",
                          }}
                        >
                          {r.isManaged ? "Managed" : "Organic"}
                        </span>
                      </span>
                    </td>
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 text-[var(--ov-soft)]">{r.brands}</td>
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono">{r.productCount}</td>
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono text-[var(--ov-soft)]">
                      {formatIdr(r.subCategoryGmv)}
                    </td>
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 text-right font-mono font-semibold text-[var(--ov-blue)]">
                      {formatIdr(r.estimatedGmv)}
                    </td>
                    <td className="border-b border-[var(--ov-fill1)] p-2.5 text-[var(--ov-soft)]">{r.dominantPillar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2.5 border-t border-[var(--ov-line)] pt-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
            Estimasi peluang = GMV creator itu di {noun} ÷ jumlah produk se-{noun} yang dia jual. Ini{" "}
            <span className="font-semibold text-[var(--ov-soft)]">estimasi kasar, bukan prediksi</span> — tidak
            memperhitungkan bahwa produk ini bisa jauh lebih kecil atau besar dari produk yang biasa dia jual.
          </div>
        </>
      )}
    </div>
  )
}
