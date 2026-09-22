import { clickhouse } from './clickhouse'
import { TABLE_SUMMARY_ORDER, toIsoDate } from './query-helpers'
import type { CompleteThrough } from './commission-completeness'

/**
 * Affiliate orders and non-affiliate (self-operated) orders load separately, so for a few days a
 * marketplace can carry self-operated GMV with little or no affiliate GMV — Shopee's affiliate
 * rows thinned to Rp17M on 19 Sep and stopped after it, while its self-operated rows ran to
 * 21 Sep. Any affiliate share taken over those days reads as a collapse that is a missing load.
 *
 * Per marketplace, this returns the last day whose affiliate GMV is at least LOADED_SHARE of the
 * marketplace's normal day (median of the one to three weeks before its latest day), but only
 * where the marketplace's other rows run past that day. A marketplace whose two loads end
 * together is complete and left out.
 */
const LOOKBACK_DAYS = 35
const LOADED_SHARE = 0.25
const TTL_MS = 60 * 60 * 1000

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
  const result = await clickhouse.query({
    query: `
      SELECT
        MARKETPLACE_NAME AS marketplace,
        DATE AS date,
        SUM(CASE WHEN IS_AFFILIATE THEN GMV ELSE 0 END) AS affiliate
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND DATE >= {since:Date}
      GROUP BY marketplace, date
    `,
    query_params: { since: daysBefore(toIsoDate(new Date()), LOOKBACK_DAYS) },
    format: 'JSONEachRow',
  })
  const rows = await result.json<{ marketplace: string; date: string; affiliate: number }>()

  const byMarketplace = new Map<string, Array<{ date: string; affiliate: number }>>()
  for (const r of rows) {
    if (!r.marketplace) continue
    const list = byMarketplace.get(r.marketplace) ?? []
    list.push({ date: String(r.date).slice(0, 10), affiliate: Number(r.affiliate || 0) })
    byMarketplace.set(r.marketplace, list)
  }

  const out: CompleteThrough = {}
  for (const [marketplace, days] of byMarketplace) {
    days.sort((a, b) => (a.date < b.date ? -1 : 1))
    const anyLast = days[days.length - 1]!.date
    const normal = median(
      days.filter((d) => d.date >= daysBefore(anyLast, 21) && d.date <= daysBefore(anyLast, 7)).map((d) => d.affiliate),
    )
    if (normal <= 0) continue
    const loaded = [...days].reverse().find((d) => d.affiliate >= normal * LOADED_SHARE)
    if (loaded && loaded.date < anyLast) out[marketplace] = loaded.date
  }
  return out
}

export async function getAffiliateCompleteThrough(): Promise<CompleteThrough> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  const value = await compute()
  cached = { at: Date.now(), value }
  return value
}
