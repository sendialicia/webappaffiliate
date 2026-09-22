import { clickhouse } from './clickhouse'
import { pctDelta, TABLE_SUMMARY_ORDER, TWO_WINDOW_CLAUSE } from './query-helpers'

/** One row of a page's creator leaderboard: the current window, plus how it moved. */
export interface CreatorLeader {
  username: string
  isManaged: boolean
  gmv: number
  gmvPrev: number
  /** null when the creator had no GMV in the comparison window. */
  growth: number | null
  /** Share of all affiliate GMV in the same slice, current window. */
  share: number
}

export interface CreatorLeadersResult {
  rows: CreatorLeader[]
  totalGmv: number
  /**
   * TikTok books agency sales under one "Agency" username. It is not a person, so it is kept out
   * of the ranking and reported beside it; null when the slice has none.
   */
  agency: CreatorLeader | null
}

const AGENCY = 'Agency'

/**
 * Top creators by current GMV with their comparison-window GMV, for the page summary. Shared by
 * the Shopee and TikTok PID pages; only the marketplace scope and the filter clause differ.
 * `params` must carry currentFrom/currentTo/prevFrom/prevTo plus whatever the clause binds.
 */
export async function getCreatorLeaders(
  marketplaceScope: string,
  filterClause: string,
  params: Record<string, unknown>,
  limit = 5,
): Promise<CreatorLeadersResult> {
  const inCurrent = 'DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}'
  const inPrev = 'DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}'

  const [leadersResult, totalResult] = await Promise.all([
    clickhouse.query({
      query: `
        SELECT
          AFFILIATE_USERNAME AS username,
          MAX(IS_MANAGED_CREATOR) AS isManaged,
          sumIf(GMV, ${inCurrent}) AS gmv,
          sumIf(GMV, ${inPrev}) AS gmvPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${marketplaceScope}
          AND IS_AFFILIATE = TRUE
          AND AFFILIATE_USERNAME IS NOT NULL
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
        GROUP BY username
        ORDER BY gmv DESC
        -- One spare row, so dropping the Agency aggregate still leaves a full board.
        LIMIT ${Math.min(Math.max(limit, 1), 20) + 1}
      `,
      query_params: params,
      format: 'JSONEachRow',
    }),
    // The denominator includes rows with no username, the same way the top-creators table does.
    clickhouse.query({
      query: `
        SELECT SUM(GMV) AS gmv
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${marketplaceScope}
          AND IS_AFFILIATE = TRUE
          AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
          ${filterClause}
      `,
      query_params: params,
      format: 'JSONEachRow',
    }),
  ])

  const raw = await leadersResult.json<{ username: string; isManaged: number; gmv: number; gmvPrev: number }>()
  const totalGmv = Number((await totalResult.json<{ gmv: number }>())[0]?.gmv ?? 0)

  const all = raw
    .map((r) => {
      const gmv = Number(r.gmv || 0)
      const gmvPrev = Number(r.gmvPrev || 0)
      return {
        username: r.username,
        isManaged: Boolean(Number(r.isManaged)),
        gmv,
        gmvPrev,
        growth: pctDelta(gmv, gmvPrev),
        share: totalGmv > 0 ? gmv / totalGmv : 0,
      }
    })
    // A creator active only in the comparison window has no place on a "top now" board.
    .filter((r) => r.gmv > 0)

  return {
    totalGmv,
    rows: all.filter((r) => r.username !== AGENCY).slice(0, limit),
    agency: all.find((r) => r.username === AGENCY) ?? null,
  }
}

/**
 * Top creators of each given product, keyed by PID. One small pair of queries per product, run
 * together: the summary asks for three, and a per-product ranking would otherwise need a window
 * function the two warehouses spell differently. Share is of that product's affiliate GMV.
 */
export async function getCreatorLeadersByProduct(
  marketplaceScope: string,
  filterClause: string,
  params: Record<string, unknown>,
  pids: string[],
  limit = 5,
): Promise<Record<string, CreatorLeadersResult>> {
  const entries = await Promise.all(
    pids.map(async (pid, i) => {
      // A distinct name per product: the calls share one params object.
      const key = `leaderPid${i}`
      const scoped = { ...params, [key]: pid }
      const result = await getCreatorLeaders(
        marketplaceScope,
        `${filterClause} AND PRODUCT_ID = {${key}:String}`,
        scoped,
        limit,
      )
      return [pid, result] as const
    }),
  )
  return Object.fromEntries(entries)
}
