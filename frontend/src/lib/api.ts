import { snapshotKey } from "@/lib/snapshot-key"

const API_URL = process.env.NEXT_PUBLIC_API_URL
const SNAPSHOT = process.env.NEXT_PUBLIC_SNAPSHOT === "1"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (SNAPSHOT) return snapshotFetch<T>(path)

  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set")
  }

  const res = await fetch(`${API_URL}${path}`, init)

  if (!res.ok) {
    throw new ApiError(res.status, `Request to ${path} failed with status ${res.status}`)
  }

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
