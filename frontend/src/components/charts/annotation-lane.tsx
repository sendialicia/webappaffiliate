"use client"

import { useEffect, useState } from "react"
import { apiFetch, isSnapshot } from "@/lib/api"
import { useAuthor } from "@/lib/author"
import type { PeriodAnnotation } from "@/types/comments"

/** The combo chart reserves 56px for its Y axis and 8px on the right; the lane matches it. */
const PLOT_LEFT = 56
const PLOT_RIGHT = 8
/** Beyond this many overlapping rows the rest collapse into a count. */
const MAX_ROWS = 3

function dayIndex(date: string, days: string[]): number {
  return days.indexOf(date)
}

interface Placed {
  a: PeriodAnnotation
  /** Percent of the plot width. */
  left: number
  width: number
  row: number
}

/**
 * Lays annotations out in rows so overlapping ones never sit on top of each other. Greedy
 * first-fit: each annotation takes the first row whose last item ends before it starts.
 */
function place(annotations: PeriodAnnotation[], days: string[]): { placed: Placed[]; overflow: number } {
  if (days.length === 0) return { placed: [], overflow: 0 }
  const step = 100 / days.length
  const rowEnds: number[] = []
  const placed: Placed[] = []
  let overflow = 0

  for (const a of annotations) {
    // Clamp to the window: an annotation can start before it or end after it.
    const start = Math.max(dayIndex(a.startsOn, days), 0)
    const rawEnd = dayIndex(a.endsOn, days)
    const end = rawEnd === -1 ? days.length - 1 : rawEnd
    if (end < start) continue

    const left = start * step
    const width = Math.max((end - start + 1) * step, step * 0.5)

    let row = rowEnds.findIndex((endPct) => endPct <= left)
    if (row === -1) {
      if (rowEnds.length >= MAX_ROWS) {
        overflow++
        continue
      }
      row = rowEnds.length
      rowEnds.push(0)
    }
    rowEnds[row] = left + width
    placed.push({ a, left, width, row })
  }

  return { placed, overflow }
}

function AnnotationForm({
  days,
  onSubmitAction,
  onCancelAction,
}: {
  days: string[]
  onSubmitAction: (input: { startsOn: string; endsOn: string; title: string; body: string }) => void
  onCancelAction: () => void
}) {
  const [startsOn, setStartsOn] = useState(days[0] ?? "")
  const [endsOn, setEndsOn] = useState(days[0] ?? "")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const invalid = !title.trim() || !startsOn || !endsOn || endsOn < startsOn

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        onSubmitAction({ startsOn, endsOn, title, body })
      }}
      className="mt-2 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] p-3"
    >
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
          Mulai
          <input
            type="date"
            value={startsOn}
            onChange={(e) => {
              setStartsOn(e.target.value)
              // A single-day note is the common case, so the end follows until it is set apart.
              if (!endsOn || endsOn < e.target.value) setEndsOn(e.target.value)
            }}
            className="h-8 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2 text-[13px] font-normal tracking-normal normal-case"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
          Selesai
          <input
            type="date"
            value={endsOn}
            min={startsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className="h-8 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2 text-[13px] font-normal tracking-normal normal-case"
          />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] font-bold tracking-wide text-[var(--ov-faint)] uppercase">
          Judul
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign 9.9"
            className="h-8 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-2 text-[13px] font-normal tracking-normal normal-case"
          />
        </label>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Keterangan tambahan (opsional)"
        className="mt-2 w-full resize-y rounded-md border border-[var(--ov-line)] bg-[var(--input)] p-2 text-[13px]"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={invalid}
          className="h-7 rounded-md border border-[var(--accent-foreground)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-foreground)] disabled:opacity-45"
        >
          Simpan anotasi
        </button>
        <button
          type="button"
          onClick={onCancelAction}
          className="h-7 rounded-md border border-[var(--ov-line)] px-3 text-xs font-semibold text-[var(--ov-mut)]"
        >
          Batal
        </button>
        {endsOn > startsOn && (
          <span className="text-[12px] text-[var(--ov-faint)]">
            Berlaku {days.filter((d) => d >= startsOn && d <= endsOn).length} hari
          </span>
        )}
      </div>
    </form>
  )
}

/**
 * Markers for dates and date ranges, in their own strip under the chart rather than drawn over
 * it. A band painted on the plot would darken unpredictably where two overlap, and would have to
 * be repeated on every time-series chart; a strip keeps the plot untouched and the layer optional.
 */
export function AnnotationLane({
  days,
  brands,
  marketplaces,
}: {
  /** Every date on the chart's X axis, in order. */
  days: string[]
  brands: string[]
  marketplaces: string[]
}) {
  const { author } = useAuthor()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [state, setState] = useState<{ key: string; rows?: PeriodAnnotation[]; error?: string } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const from = days[0]
  const to = days[days.length - 1]
  const url =
    from && to
      ? `/api/annotations?from=${from}&to=${to}` +
        (brands.length ? `&brand=${encodeURIComponent(brands.join(","))}` : "") +
        (marketplaces.length ? `&marketplace=${encodeURIComponent(marketplaces.join(","))}` : "")
      : null

  useEffect(() => {
    if (!url) return
    apiFetch<PeriodAnnotation[]>(url)
      .then((rows) => setState({ key: url, rows }))
      .catch(() => setState({ key: url, error: "database anotasi tidak terhubung" }))
  }, [url, reloadToken])

  const current = state?.key === url ? state : null
  const rows = current?.rows ?? []
  const { placed, overflow } = place(rows, days)

  if (isSnapshot || !from || !to) return null

  const save = (input: { startsOn: string; endsOn: string; title: string; body: string }) => {
    if (!author) return
    apiFetch("/api/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
      .catch(() => undefined)
      .finally(() => {
        setAdding(false)
        setReloadToken((t) => t + 1)
      })
  }

  const remove = (id: number) => {
    if (!author) return
    apiFetch(`/api/annotations/${id}`, { method: "DELETE" })
      .catch(() => undefined)
      .finally(() => setReloadToken((t) => t + 1))
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"
          style={{
            borderColor: open ? "var(--accent-foreground)" : "var(--ov-line)",
            background: open ? "var(--accent)" : "transparent",
            color: open ? "var(--accent-foreground)" : "var(--ov-mut)",
          }}
        >
          Anotasi
          {rows.length > 0 && (
            <span className="rounded-full bg-[var(--ov-fill1)] px-1.5 text-[11.5px]">{rows.length}</span>
          )}
        </button>
        {open && !adding && author && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-7 rounded-full border border-[var(--ov-line)] px-3 text-xs font-semibold text-[var(--ov-mut)] hover:bg-[var(--ov-fill1)]"
          >
            + Tambah
          </button>
        )}
        {current?.error && (
          <span className="text-[12px] text-[var(--ov-faint)]">{current.error}</span>
        )}
      </div>

      {open && (
        <>
          <div
            className="relative mt-2"
            style={{ marginLeft: PLOT_LEFT, marginRight: PLOT_RIGHT, height: MAX_ROWS * 20 }}
          >
            {placed.map(({ a, left, width, row }) => {
              const single = a.startsOn === a.endsOn
              return (
                <span
                  key={a.id}
                  title={`${a.title}${a.body ? ` — ${a.body}` : ""}\n${single ? a.startsOn : `${a.startsOn} s/d ${a.endsOn}`}\noleh ${a.author.name}`}
                  className="absolute flex h-4 items-center overflow-hidden rounded-[3px] px-1 text-[11.5px] font-semibold whitespace-nowrap"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: row * 20,
                    background: single ? "var(--ov-q-lo)" : "var(--ov-q-hi)",
                    color: "var(--ov-logo-ink, #10203c)",
                    minWidth: 6,
                  }}
                >
                  {width > 6 ? a.title : ""}
                </span>
              )
            })}
            {rows.length === 0 && !current?.error && (
              <span className="text-[12px] text-[var(--ov-faint)]">
                Belum ada anotasi pada periode ini.
              </span>
            )}
          </div>

          {overflow > 0 && (
            <div className="mt-1 text-[12px] text-[var(--ov-faint)]">
              +{overflow} anotasi lain bertindih dan tidak digambar — ada di daftar di bawah.
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {rows.map((a) => (
                <div key={a.id} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                  <span className="font-mono text-[var(--ov-faint)]">
                    {a.startsOn === a.endsOn ? a.startsOn : `${a.startsOn} – ${a.endsOn}`}
                  </span>
                  <span className="font-semibold text-[var(--ov-soft)]">{a.title}</span>
                  {a.brand && (
                    <span className="rounded bg-[var(--ov-fill1)] px-1.5 text-[11.5px] text-[var(--ov-faint)]">
                      {a.brand}
                    </span>
                  )}
                  {a.body && <span className="text-[var(--ov-faint)]">{a.body}</span>}
                  <span className="text-[var(--ov-dim)]">· {a.author.name}</span>
                  {author?.id === a.author.id && (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="font-semibold text-[var(--ov-faint)] hover:text-[var(--ov-red-ink)]"
                    >
                      hapus
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {adding && author && (
            <AnnotationForm days={days} onSubmitAction={save} onCancelAction={() => setAdding(false)} />
          )}

        </>
      )}
    </div>
  )
}
