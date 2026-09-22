import { clickhouse } from './clickhouse'
import { TABLE_SUMMARY_ORDER, toIsoDate } from './query-helpers'

/**
 * Commission is booked days after the order — TikTok's arrives over roughly ten days, Shopee's
 * within one or two — so the latest days carry GMV with little or no commission. A ratio taken
 * over them (ROI, commission rate) reads as a jump that is really just missing data.
 *
 * This finds, per marketplace, the last day whose commission already looks complete: the latest
 * day whose commission rate is at least COMPLETE_SHARE of that marketplace's normal rate. The
 * normal rate is the median daily rate between three and eight weeks before the latest day —
 * long settled, and recent enough to reflect current commission terms. Nothing is hard-coded to
 * a date, so the cut moves forward on its own as commission lands.
 *
 * 75% rather than something tighter: campaign days (8.8, 9.9) legitimately run a point or two
 * below the normal rate, and those must not be mistaken for missing commission. Lag shows up
 * as a steady slide to zero, far below this line.
 */
const COMPLETE_SHARE = 0.75
const LOOKBACK_DAYS = 70
const BASELINE_FROM_DAYS = 56
const BASELINE_TO_DAYS = 21
const TTL_MS = 60 * 60 * 1000

/** Marketplace name (as in MARKETPLACE_NAME) → last day with complete commission. */
export type CompleteThrough = Record<string, string>

let cached: { at: number; value: CompleteThrough } | null = null

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return toIsoDate(d)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

async function compute(): Promise<CompleteThrough> {
  const since = daysBefore(toIsoDate(new Date()), LOOKBACK_DAYS)
  const result = await clickhouse.query({
    query: `
      SELECT MARKETPLACE_NAME AS marketplace, DATE AS date, SUM(GMV) AS gmv, SUM(COMMISSION) AS commission
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        AND DATE >= {since:Date}
      GROUP BY marketplace, date
    `,
    query_params: { since },
    format: 'JSONEachRow',
  })
  const rows = await result.json<{ marketplace: string; date: string; gmv: number; commission: number }>()

  const byMarketplace = new Map<string, Array<{ date: string; rate: number }>>()
  for (const r of rows) {
    const gmv = Number(r.gmv || 0)
    if (gmv <= 0 || !r.marketplace) continue
    const list = byMarketplace.get(r.marketplace) ?? []
    list.push({ date: String(r.date).slice(0, 10), rate: Number(r.commission || 0) / gmv })
    byMarketplace.set(r.marketplace, list)
  }

  const out: CompleteThrough = {}
  for (const [marketplace, days] of byMarketplace) {
    days.sort((a, b) => (a.date < b.date ? -1 : 1))
    const latest = days[days.length - 1]!.date
    const baselineFrom = daysBefore(latest, BASELINE_FROM_DAYS)
    const baselineTo = daysBefore(latest, BASELINE_TO_DAYS)
    const normal = median(days.filter((d) => d.date >= baselineFrom && d.date <= baselineTo).map((d) => d.rate))
    // Too little history to judge: treat everything as complete rather than guess.
    if (normal <= 0) {
      out[marketplace] = latest
      continue
    }
    const lastComplete = [...days].reverse().find((d) => d.rate >= normal * COMPLETE_SHARE)
    out[marketplace] = lastComplete?.date ?? baselineTo
  }
  return out
}

export async function getCommissionCompleteThrough(): Promise<CompleteThrough> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  const value = await compute()
  cached = { at: Date.now(), value }
  return value
}

/**
 * A SQL condition that is true on rows whose commission counts as complete, for both windows.
 * The comparison window is cut at the same day offset as the current one, so the two ratios
 * cover like-for-like stretches. Marketplaces the check has no data for are left uncut.
 */
export function completeCommissionCondition(
  through: CompleteThrough,
  windows: { from: string; prevFrom: string },
  params: Record<string, unknown>,
): string {
  const offsetDays = (a: string, b: string) =>
    Math.round((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000)

  const parts: string[] = []
  const names = Object.keys(through)
  names.forEach((marketplace, i) => {
    const cut = through[marketplace]!
    const offset = offsetDays(cut, windows.from)
    const prevCut = daysBefore(windows.prevFrom, -offset)
    params[`ccName${i}`] = marketplace
    params[`ccCut${i}`] = cut
    params[`ccPrevCut${i}`] = prevCut
    parts.push(
      `(MARKETPLACE_NAME = {ccName${i}:String} AND (` +
        `(DATE >= {currentFrom:Date} AND DATE <= {ccCut${i}:Date}) OR ` +
        `(DATE >= {prevFrom:Date} AND DATE <= {ccPrevCut${i}:Date})))`,
    )
  })
  if (names.length > 0) {
    params.ccNames = names
    parts.push(`MARKETPLACE_NAME NOT IN {ccNames:Array(String)}`)
  }
  return parts.length > 0 ? `(${parts.join(' OR ')})` : 'TRUE'
}
