"use client"

import { useEffect, useState } from "react"
import { apiFetch, isSnapshot } from "@/lib/api"
import { useAuthor } from "@/lib/author"
import type { Author, ProductComment } from "@/types/comments"

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "baru saja"
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

function Composer({
  placeholder,
  initial = "",
  submitLabel,
  onSubmitAction,
  onCancelAction,
}: {
  placeholder: string
  initial?: string
  submitLabel: string
  onSubmitAction: (body: string) => void
  onCancelAction?: () => void
}) {
  const [body, setBody] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!body.trim()) return
        onSubmitAction(body)
        setBody("")
      }}
      className="flex flex-col gap-1.5"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-md border border-[var(--ov-line)] bg-[var(--input)] p-2 text-[13px] leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!body.trim()}
          className="h-7 rounded-md border border-[var(--accent-foreground)] bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-foreground)] disabled:opacity-45"
        >
          {submitLabel}
        </button>
        {onCancelAction && (
          <button
            type="button"
            onClick={onCancelAction}
            className="h-7 rounded-md border border-[var(--ov-line)] px-3 text-xs font-semibold text-[var(--ov-mut)]"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  )
}

function CommentRow({
  comment,
  author,
  depth,
  onReplyAction,
  onEditAction,
  onDeleteAction,
}: {
  comment: ProductComment
  author: Author | null
  depth: number
  onReplyAction: (parentId: number, body: string) => void
  onEditAction: (id: number, body: string) => void
  onDeleteAction: (id: number) => void
}) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const mine = author !== null && author.id === comment.author.id

  return (
    <div className={depth > 0 ? "mt-2 border-l border-[var(--ov-line)] pl-3" : "mt-3"}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[13px] font-semibold text-[var(--ov-soft)]">{comment.author.name}</span>
        {comment.author.source === "local" && (
          <span
            title="Ditulis sebelum login Microsoft aktif, jadi identitasnya belum terverifikasi"
            className="rounded bg-[var(--ov-fill1)] px-1.5 py-px text-[10.5px] font-bold tracking-wide text-[var(--ov-faint)] uppercase"
          >
            belum terverifikasi
          </span>
        )}
        <span className="text-[12px] text-[var(--ov-faint)]">{timeAgo(comment.createdAt)}</span>
        {comment.updatedAt !== comment.createdAt && !comment.deleted && (
          <span className="text-[12px] text-[var(--ov-faint)]">· disunting</span>
        )}
      </div>

      {comment.deleted ? (
        <div className="mt-0.5 text-[13px] text-[var(--ov-faint)] italic">Komentar dihapus.</div>
      ) : editing ? (
        <div className="mt-1.5">
          <Composer
            placeholder="Sunting komentar"
            initial={comment.body}
            submitLabel="Simpan"
            onSubmitAction={(body) => {
              onEditAction(comment.id, body)
              setEditing(false)
            }}
            onCancelAction={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--ov-ink)]">
          {comment.body}
        </div>
      )}

      {!comment.deleted && !editing && (
        <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
          {depth === 0 && author && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="font-semibold text-[var(--ov-blue)]"
            >
              Balas
            </button>
          )}
          {mine && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-semibold text-[var(--ov-faint)] hover:text-[var(--ov-ink)]"
              >
                Sunting
              </button>
              <button
                type="button"
                onClick={() => onDeleteAction(comment.id)}
                className="font-semibold text-[var(--ov-faint)] hover:text-[var(--ov-red-ink)]"
              >
                Hapus
              </button>
            </>
          )}
        </div>
      )}

      {replying && (
        <div className="mt-2">
          <Composer
            placeholder={`Balas ${comment.author.name}`}
            submitLabel="Balas"
            onSubmitAction={(body) => {
              onReplyAction(comment.id, body)
              setReplying(false)
            }}
            onCancelAction={() => setReplying(false)}
          />
        </div>
      )}

      {comment.replies.map((r) => (
        <CommentRow
          key={r.id}
          comment={r}
          author={author}
          depth={depth + 1}
          onReplyAction={onReplyAction}
          onEditAction={onEditAction}
          onDeleteAction={onDeleteAction}
        />
      ))}
    </div>
  )
}

/**
 * Comments on one product or SKU. Kept out of the analytics request path entirely: it reads from
 * Postgres, and if that is unreachable the panel says so rather than breaking the page around it.
 */
export function CommentsPanel({
  productId,
  barcode,
  marketplace,
}: {
  productId?: string | undefined
  barcode?: string | undefined
  marketplace?: string | undefined
}) {
  const { author } = useAuthor()
  const target = productId ?? barcode ?? ""
  const url = productId
    ? `/api/comments?productId=${encodeURIComponent(productId)}`
    : barcode
      ? `/api/comments?barcode=${encodeURIComponent(barcode)}`
      : null

  const [state, setState] = useState<{ key: string; rows?: ProductComment[]; error?: string } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!url) return
    apiFetch<ProductComment[]>(url)
      .then((rows) => setState({ key: url, rows }))
      .catch(() =>
        // Almost always "Postgres is not running"; the analytics on this page still work.
        setState({ key: url, error: "Komentar belum bisa dimuat — database komentar tidak terhubung." }),
      )
  }, [url, reloadToken])

  const current = state?.key === url ? state : null
  const rows = current?.rows ?? []
  const reload = () => setReloadToken((t) => t + 1)

  const send = (path: string, method: string, payload: Record<string, unknown>) => {
    if (!author) return
    apiFetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .catch(() => undefined)
      .finally(reload)
  }

  // The static snapshot has no backend to read or write comments against.
  if (!target || isSnapshot) return null

  const count = rows.reduce((a, c) => a + 1 + c.replies.length, 0)

  return (
    <div className="mt-4 border-t border-[var(--ov-line)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--ov-mut)]">Komentar</span>
        {count > 0 && (
          <span className="rounded-full bg-[var(--ov-fill1)] px-2 py-0.5 text-[12px] font-semibold text-[var(--ov-soft)]">
            {count}
          </span>
        )}
      </div>

      {current?.error && (
        <div className="mt-2 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill2)] px-3 py-2 text-[12.5px] text-[var(--ov-faint)]">
          {current.error}
        </div>
      )}

      {!current?.error && (
        <>
          {rows.length === 0 && (
            <div className="mt-1.5 text-[12.5px] text-[var(--ov-faint)]">
              Belum ada komentar untuk produk ini.
            </div>
          )}

          {rows.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              author={author}
              depth={0}
              onReplyAction={(parentId, body) =>
                send("/api/comments", "POST", { productId, barcode, marketplace, parentId, body })
              }
              onEditAction={(id, body) => send(`/api/comments/${id}`, "PATCH", { body })}
              onDeleteAction={(id) => send(`/api/comments/${id}`, "DELETE", {})}
            />
          ))}

          <div className="mt-3">
            {author ? (
              <Composer
                placeholder="Tulis komentar tentang produk ini…"
                submitLabel="Kirim"
                onSubmitAction={(body) =>
                  send("/api/comments", "POST", { productId, barcode, marketplace, body })
                }
              />
            ) : (
              <div className="text-[12.5px] text-[var(--ov-faint)]">Memuat sesi login…</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
