/**
 * Turns an API path into a stable filename. Used by both the capture script and the
 * browser, so the two must agree exactly — query params are sorted so that a
 * different call-site ordering still resolves to the same file.
 */
export function snapshotKey(path: string): string {
  const [rawPath, rawQuery = ""] = path.split("?")
  const params = new URLSearchParams(rawQuery)
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const canonical = `${rawPath}?${sorted.map(([k, v]) => `${k}=${v}`).join("&")}`

  // FNV-1a: deterministic, synchronous, and identical in Node and the browser.
  let hash = 0x811c9dc5
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  const slug = (rawPath.replace(/^\/api\//, "").replace(/[^a-z0-9]+/gi, "-") || "root").slice(0, 40)
  return `${slug}-${hash.toString(16).padStart(8, "0")}`
}
