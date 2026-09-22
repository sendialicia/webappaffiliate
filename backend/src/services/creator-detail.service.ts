import { clickhouse } from '../lib/clickhouse'
import { TABLE_SUMMARY_ORDER, bucketExpression, ratio } from '../lib/query-helpers'
import { getNames } from '../lib/name-cache'
import type { TrendGranularity } from '../types/overview'
import type { CreatorDetail, CreatorProductRow } from '../types/creator-detail'

export interface CreatorDetailSpec {
  username: string
  /** Marketplace/bundle scope, built by the calling page's own filter code. */
  scope: string
  /** Extra brand/dimension filters, already parameterised. */
  filterClause: string
  /** Product identity for the "top products" list — PRODUCT_ID, or BARCODE on the SKU page. */
  idColumn: string
  /** Cache spec so product names come from the warm map instead of a second scan. */
  nameCacheKey: string
  nameColumn: string
  from: string
  to: string
  granularity: TrendGranularity
  params: Record<string, unknown>
}

/**
 * Everything a reader wants about one creator, from the order table alone.
 *
 * Three queries rather than one: the daily grain, the per-product grain and the rank-among-peers
 * grain cannot share a GROUP BY. Product names come from the warm name cache, which keeps a
 * fourth scan off the path. Called only when a row is clicked, and the response cache holds it
 * afterwards.
 */
export async function getCreatorDetail(spec: CreatorDetailSpec): Promise<CreatorDetail> {
  const params: Record<string, unknown> = {
    ...spec.params,
    username: spec.username,
    from: spec.from,
    to: spec.to,
  }
  const where = `${spec.scope}
    AND IS_AFFILIATE = TRUE
    AND AFFILIATE_USERNAME = {username:String}
    AND DATE >= {from:Date} AND DATE <= {to:Date}
    ${spec.filterClause}`

  // Daily grain: the trend, and — summed — the totals, pillars and reach.
  const dailyResult = await clickhouse.query({
    query: `
      SELECT
        ${bucketExpression(spec.granularity)} AS bucket,
        SUM(GMV) AS gmv,
        SUM(ATTRIBUTED_ORDERS) AS orders,
        SUM(ITEMS_SOLD) AS itemsSold,
        SUM(COMMISSION) AS commission,
        -- Days, not buckets: with a weekly or monthly trend one bucket spans many days.
        uniqExactIf(DATE, GMV <> 0) AS activeDays,
        sumIf(GMV, PILLAR = 'Livestream') AS livestream,
        sumIf(GMV, PILLAR = 'Video') AS video,
        sumIf(GMV, PILLAR = 'Product Card') AS productCard,
        MAX(IS_MANAGED_CREATOR) AS isManaged,
        groupUniqArray(ifNull(BRAND_NAME, 'Unknown')) AS brands,
        groupUniqArray(MARKETPLACE_NAME) AS marketplaces,
        groupUniqArray(ifNull(PID_CATEGORY, 'Unknown')) AS categories,
        groupUniqArray(ifNull(PID_SUB_CATEGORY, 'Unknown')) AS subCategories
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${where}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type DailyRow = {
    bucket: string
    gmv: number
    orders: number
    itemsSold: number
    commission: number
    activeDays: number
    livestream: number
    video: number
    productCard: number
    isManaged: number
    brands: string[]
    marketplaces: string[]
    categories: string[]
    subCategories: string[]
  }
  const days = await dailyResult.json<DailyRow>()

  const sum = (pick: (r: DailyRow) => number) => days.reduce((a, r) => a + Number(pick(r) || 0), 0)
  const union = (pick: (r: DailyRow) => string[]) =>
    [...new Set(days.flatMap((r) => pick(r) ?? []))].filter(Boolean).sort()

  const gmv = sum((r) => r.gmv)
  const orders = sum((r) => r.orders)

  const productResult = await clickhouse.query({
    query: `
      SELECT ${spec.idColumn} AS id, SUM(GMV) AS gmv
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${where}
      GROUP BY id
      ORDER BY gmv DESC
      LIMIT 10
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const productRows = await productResult.json<{ id: string; gmv: number }>()

  const countResult = await clickhouse.query({
    query: `SELECT uniqExact(${spec.idColumn}) AS productCount FROM ${TABLE_SUMMARY_ORDER} WHERE ${where}`,
    query_params: params,
    format: 'JSONEachRow',
  })
  const productCount = Number((await countResult.json<{ productCount: number }>())[0]?.productCount ?? 0)

  const { names } = await getNames({
    key: spec.nameCacheKey,
    idColumn: spec.idColumn,
    scope: spec.scope,
    nameColumn: spec.nameColumn,
  })

  const topProducts: CreatorProductRow[] = productRows.map((r) => ({
    id: r.id,
    name: names.get(r.id) ?? r.id,
    gmv: Number(r.gmv || 0),
    share: gmv > 0 ? Number(r.gmv || 0) / gmv : 0,
  }))

  // Rank among every creator in the same scope. The scalar subquery resolves this creator's own
  // GMV once, so the outer pass only has to count who beats it.
  const rankResult = await clickhouse.query({
    query: `
      -- The creator's own GMV joins in as a one-row table rather than ClickHouse's scalar
      -- WITH (subquery) AS mine, which Snowflake has no equivalent for.
      SELECT count() AS totalCreators, countIf(t.g > ifNull(m.mine, 0)) + 1 AS rank
      FROM (
        SELECT AFFILIATE_USERNAME AS u, SUM(GMV) AS g
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${spec.scope}
          AND IS_AFFILIATE = TRUE
          AND AFFILIATE_USERNAME IS NOT NULL
          AND DATE >= {from:Date} AND DATE <= {to:Date}
          ${spec.filterClause}
        GROUP BY u
      ) t
      CROSS JOIN (
        SELECT SUM(GMV) AS mine FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${spec.scope}
          AND IS_AFFILIATE = TRUE
          AND AFFILIATE_USERNAME = {username:String}
          AND DATE >= {from:Date} AND DATE <= {to:Date}
          ${spec.filterClause}
      ) m
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const rankRow = (await rankResult.json<{ totalCreators: number; rank: number }>())[0]
  const totalCreators = Number(rankRow?.totalCreators ?? 0)
  const rank = Number(rankRow?.rank ?? 0)

  return {
    username: spec.username,
    isManaged: days.some((r) => Number(r.isManaged) === 1),
    gmv,
    orders,
    itemsSold: sum((r) => r.itemsSold),
    commission: sum((r) => r.commission),
    aov: ratio(gmv, orders),
    // Buckets partition the dates, so summing each bucket's distinct days is exact.
    activeDays: sum((r) => r.activeDays),
    productCount,
    rank,
    totalCreators,
    /** Share of creators this one beats; 1 means top of the scope. */
    percentile: totalCreators > 0 ? (totalCreators - rank + 1) / totalCreators : 0,
    pillars: {
      livestream: sum((r) => r.livestream),
      video: sum((r) => r.video),
      productCard: sum((r) => r.productCard),
    },
    brands: union((r) => r.brands),
    marketplaces: union((r) => r.marketplaces),
    categoryCount: union((r) => r.categories).length,
    subCategoryCount: union((r) => r.subCategories).length,
    topProducts,
    trend: days.map((r) => ({ bucket: r.bucket, gmv: Number(r.gmv || 0) })),
  }
}
