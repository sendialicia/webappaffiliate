import { snapshotKey } from "@/lib/snapshot-key"

const SNAPSHOT = process.env.NEXT_PUBLIC_SNAPSHOT === "1"

/** Snapshot builds have no backend, so anything that writes has to hide itself. */
export const isSnapshot = SNAPSHOT

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * In the browser every call goes through the Next.js route at /api/backend, which checks the
 * login session and forwards to Express with the internal secret — the browser never holds a
 * token or talks to Express itself. Server components have no session cookie to forward and no
 * relative origin to resolve, so they call Express directly with the secret instead.
 */
function resolve(path: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (typeof window !== "undefined") return { url: `/api/backend${path}`, init }

  const secret = process.env.INTERNAL_API_SECRET ?? ""
  const headers = new Headers(init?.headers)
  headers.set("x-internal-secret", secret)
  return { url: `${process.env.BACKEND_URL ?? "http://localhost:4000"}${path}`, init: { ...init, headers } }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (SNAPSHOT) return snapshotFetch<T>(path)

  const target = resolve(path, init)
  let res: Response
  try {
    res = await fetch(target.url, target.init)
  } catch {
    // Next.js itself unreachable (dev server stopped), as opposed to the backend failing a query.
    throw new ApiError(0, "Server tidak merespons. Pastikan `npm run dev` di folder frontend dan backend sedang jalan.")
  }

  // The session ran out while the page was open: send the reader back through login rather
  // than leaving every section showing an error.
  if (res.status === 401 && typeof window !== "undefined") {
    const back = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(back)}`)
    throw new ApiError(401, "Sesi login habis. Mengarahkan ke halaman login…")
  }

  if (!res.ok) {
    // The backend explains actionable failures (VPN off, for instance), so prefer
    // its message over a bare status code.
    const message = await res
      .json()
      .then((body) => (body as { error?: string })?.error)
      .catch(() => undefined)
    throw new ApiError(res.status, message ?? `Request to ${path} failed with status ${res.status}`)
  }

  // A 204 carries no body, which res.json() would choke on — DELETE endpoints return one.
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T

  return res.json() as Promise<T>
}

/**
 * Snapshot mode reads pre-captured JSON from /snapshot instead of the backend, so the
 * exported build runs with no ClickHouse and no API. Only the filter combinations
 * recorded by scripts/capture-snapshot.mjs exist, so a miss is reported plainly
 * rather than looking like a backend outage.
 */
async function snapshotFetch<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  const res = await fetch(`${base}/snapshot/${snapshotKey(path)}.json`)

  if (!res.ok) {
    throw new ApiError(
      404,
      "Kombinasi filter ini tidak ada di snapshot. Snapshot hanya memuat sebagian kombinasi — kembalikan filter ke posisi awal, atau jalankan ulang capture dengan kombinasi ini.",
    )
  }

  return res.json() as Promise<T>
}
