#!/usr/bin/env node
/**
 * Captures backend responses into frontend/public/snapshot so the exported build can
 * run with no backend and no ClickHouse.
 *
 * Run it while the backend is up and the VPN is connected:
 *   npm run snapshot:capture
 *
 * It walks a curated matrix of filter combinations rather than every possible one —
 * the full cross product is effectively unbounded. Whatever is not captured shows a
 * clear "not in snapshot" message in the UI instead of silently looking broken.
 */
import { mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(HERE, "..", "public", "snapshot")
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
const CONCURRENCY = Number(process.env.SNAPSHOT_CONCURRENCY ?? 3)

// --- keep in sync with src/lib/snapshot-key.ts -------------------------------
function snapshotKey(p) {
  const [rawPath, rawQuery = ""] = p.split("?")
  const params = new URLSearchParams(rawQuery)
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const canonical = `${rawPath}?${sorted.map(([k, v]) => `${k}=${v}`).join("&")}`

  let hash = 0x811c9dc5
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  const slug = (rawPath.replace(/^\/api\//, "").replace(/[^a-z0-9]+/gi, "-") || "root").slice(0, 40)
  return `${slug}-${hash.toString(16).padStart(8, "0")}`
}

// --- date presets, mirroring src/lib/date-range.ts ---------------------------
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function presetRange(preset, today = new Date()) {
  const startOfQuarter = (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
  switch (preset) {
    case "mtd":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }
    case "qtd":
      return { from: iso(startOfQuarter(today)), to: iso(today) }
    case "ytd":
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) }
    case "last-quarter": {
      const end = new Date(startOfQuarter(today))
      end.setDate(end.getDate() - 1)
      return { from: iso(startOfQuarter(end)), to: iso(end) }
    }
    default:
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }
  }
}

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function query(params) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v))
  const qs = s.toString()
  return qs ? `?${qs}` : ""
}

// --- the matrix --------------------------------------------------------------
// Explicit scenarios rather than a cross product: the cross product runs into the
// thousands and each request costs 1-5s against a 41M-row table. These cover the
// default view plus the interactions a reviewer is most likely to try.
const SCENARIOS = [
  { preset: "mtd" },
  { preset: "mtd", compare: "ly" },
  { preset: "ytd" },
  { preset: "qtd" },
  { preset: "mtd", brand: "Wardah" },
  { preset: "mtd", brand: "OMG" },
  { preset: "mtd", marketplace: "Tiktok" },
  { preset: "mtd", marketplace: "Shopee" },
  { preset: "ytd", brand: "Wardah" },
]

const PID_SCENARIOS = [
  { preset: "mtd" },
  { preset: "mtd", compare: "ly" },
  { preset: "ytd" },
  { preset: "mtd", brand: "Wardah" },
]

const COMPOSITION_DIMS = ["pillar", "category", "format"]
const DRIVER_ENTITIES = ["brand", "marketplace"]
const DRIVER_DIMS = ["format", "category"]
const PID_LEVELS = ["category", "subcategory", "format"]
const GRANULARITIES = ["day", "week", "month"]
const SECTION_BRANDS = [undefined, "Wardah", "OMG"]
const SECTION_MARKETPLACES = [undefined, "Tiktok", "Shopee"]

function overviewUrls() {
  const urls = new Set()
  const year = new Date().getFullYear()
  const month = currentMonth()

  // Sections 1-3 read daily_performance and only vary by brand/marketplace.
  for (const brand of SECTION_BRANDS) {
    for (const marketplace of SECTION_MARKETPLACES) {
      urls.add(`/api/overview/monthly-performance${query({ year, brand, marketplace })}`)
      urls.add(`/api/overview/daily-performance${query({ month, brand, marketplace })}`)
      urls.add(`/api/overview/progress${query({ month, brand, marketplace })}`)
    }
  }

  for (const sc of SCENARIOS) {
    const { from, to } = presetRange(sc.preset)
    const compare = sc.compare ?? "prev"
    const scope = { from, to, brand: sc.brand, marketplace: sc.marketplace }

    urls.add(`/api/overview/filter-options${query(scope)}`)
    urls.add(`/api/overview/funnel${query({ ...scope, compare })}`)
    urls.add(`/api/overview/summary${query({ ...scope, compare, granularity: "day" })}`)

    for (const dimension of COMPOSITION_DIMS) {
      urls.add(`/api/overview/composition${query({ ...scope, compare, granularity: "day", dimension })}`)
    }
    for (const entity of DRIVER_ENTITIES) {
      for (const dimension of DRIVER_DIMS) {
        urls.add(`/api/overview/drivers${query({ ...scope, compare, entity, dimension })}`)
      }
      urls.add(`/api/overview/spend${query({ ...scope, compare, granularity: "day", entity })}`)
    }
  }

  // Trend granularity on the default scope only.
  const { from, to } = presetRange("mtd")
  for (const granularity of GRANULARITIES) {
    urls.add(`/api/overview/summary${query({ from, to, compare: "prev", granularity })}`)
    urls.add(`/api/overview/spend${query({ from, to, compare: "prev", granularity, entity: "brand" })}`)
    urls.add(`/api/overview/composition${query({ from, to, compare: "prev", granularity, dimension: "pillar" })}`)
  }

  // Drilling into any month from the annual chart.
  for (let m = 1; m <= 12; m++) {
    const mm = `${new Date().getFullYear()}-${String(m).padStart(2, "0")}`
    urls.add(`/api/overview/daily-performance${query({ month: mm })}`)
    urls.add(`/api/overview/progress${query({ month: mm })}`)
  }

  return [...urls]
}

function shopeePidUrls() {
  const urls = new Set()

  for (const sc of PID_SCENARIOS) {
    const { from, to } = presetRange(sc.preset)
    const compare = sc.compare ?? "prev"
    const base = { from, to, brand: sc.brand, compare }

    for (const level of PID_LEVELS) {
      urls.add(`/api/shopee-pid/categories${query({ ...base, level })}`)
      urls.add(`/api/shopee-pid/products${query({ ...base, level })}`)
      urls.add(`/api/shopee-pid/trend${query({ ...base, level, granularity: "day" })}`)
      urls.add(`/api/shopee-pid/top-creators${query({ ...base, level, limit: 25 })}`)
    }
  }

  return [...urls]
}

/** Scopes and product detail need the data itself, so these are discovered live. */
async function discoveredUrls(fetchJson) {
  const urls = new Set()
  const { from, to } = presetRange("mtd")

  for (const level of PID_LEVELS) {
    const cats = await fetchJson(`/api/shopee-pid/categories${query({ from, to, level, compare: "prev" })}`)
    const names = (cats?.rows ?? []).slice(0, 5).map((r) => r.name)
    for (const scope of names) {
      const base = { from, to, level, scope, compare: "prev" }
      urls.add(`/api/shopee-pid/products${query(base)}`)
      urls.add(`/api/shopee-pid/trend${query({ ...base, granularity: "day" })}`)
      urls.add(`/api/shopee-pid/top-creators${query({ ...base, limit: 25 })}`)
      for (const pillar of ["Livestream", "Video", "Product Card"]) {
        urls.add(`/api/shopee-pid/top-creators${query({ ...base, pillar, limit: 25 })}`)
      }
    }
  }

  // Deep dive for the biggest products, which is what anyone clicks first.
  const products = await fetchJson(`/api/shopee-pid/products${query({ from, to, level: "category", compare: "prev" })}`)
  const topPids = (products?.rows ?? []).slice(0, 20).map((r) => r.pid)
  for (const pid of topPids) {
    urls.add(`/api/shopee-pid/product-detail${query({ pid, from, to, compare: "prev", granularity: "day" })}`)
  }

  return [...urls]
}

async function main() {
  // Heavy queries time out sporadically when several run at once, so a failure is
  // retried before being reported.
  const fetchJson = async (p, attempts = 3) => {
    for (let i = 1; ; i++) {
      try {
        const res = await fetch(`${API}${p}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } catch (e) {
        if (i >= attempts) throw e
        await new Promise((r) => setTimeout(r, 2000 * i))
      }
    }
  }

  // --only-missing keeps what is already captured and fills the gaps.
  const onlyMissing = process.argv.includes('--only-missing')

  console.log(`Backend: ${API}`)
  process.stdout.write("Menyiapkan daftar URL… ")
  const discovered = await discoveredUrls(fetchJson)
  const urls = [...new Set([...overviewUrls(), ...shopeePidUrls(), ...discovered])]
  console.log(`${urls.length} permintaan`)

  if (existsSync(OUT_DIR) && !onlyMissing) await rm(OUT_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  const manifest = {}
  if (onlyMissing) {
    const manifestPath = path.join(OUT_DIR, 'manifest.json')
    if (existsSync(manifestPath)) {
      const prev = JSON.parse(await readFile(manifestPath, 'utf8'))
      Object.assign(manifest, prev.urls ?? {})
    }
    const before = urls.length
    for (let i = urls.length - 1; i >= 0; i--) {
      if (existsSync(path.join(OUT_DIR, `${snapshotKey(urls[i])}.json`))) urls.splice(i, 1)
    }
    console.log(`  --only-missing: ${before - urls.length} sudah ada, ${urls.length} akan diambil`)
  }
  let done = 0
  let failed = 0
  const started = Date.now()

  const worker = async () => {
    for (;;) {
      const url = urls.pop()
      if (!url) return
      try {
        const data = await fetchJson(url)
        const key = snapshotKey(url)
        await writeFile(path.join(OUT_DIR, `${key}.json`), JSON.stringify(data))
        manifest[key] = url
      } catch (e) {
        failed++
        console.warn(`\n  gagal: ${url} — ${e.message}`)
      }
      done++
      if (done % 10 === 0 || urls.length === 0) {
        process.stdout.write(`\r  ${done} selesai, ${urls.length} sisa, ${failed} gagal   `)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify({ capturedAt: new Date().toISOString(), count: Object.keys(manifest).length, urls: manifest }, null, 2),
  )

  const secs = ((Date.now() - started) / 1000).toFixed(0)
  console.log(`\nSelesai dalam ${secs}s — ${Object.keys(manifest).length} file di public/snapshot (${failed} gagal)`)
}

main().catch((e) => {
  console.error("Capture gagal:", e.message)
  process.exit(1)
})
