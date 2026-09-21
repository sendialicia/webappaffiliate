import { clickhouse } from '../lib/clickhouse'
import { TABLE_SUMMARY_ORDER } from '../lib/query-helpers'
import type { OpportunityCreatorRow, OpportunityCreatorsResult } from '../types/shopee-pid'

/** Matches the definition the mentor signed off on. */
export const OPPORTUNITY_LOOKBACK_DAYS = 180

export type SimilarityLevel = 'category' | 'subcategory' | 'format'

/** Resolves a tier to a column for a given attribute family (PID_ or PRODUCT_). */
export function similarityColumn(prefix: 'PID' | 'PRODUCT', level: SimilarityLevel): string {
  if (level === 'category') return `${prefix}_CATEGORY`
  if (level === 'format') return `${prefix}_FORMAT`
  return `${prefix}_SUB_CATEGORY`
}
const MIN_PRODUCTS = 2

export interface OpportunitySpec {
  /** Marketplace/bundle scope, already built by the caller's own filter code. */
  scope: string
  /** Column holding the product identity — PRODUCT_ID on the PID pages, BARCODE on SKU. */
  idColumn: string
  /**
   * Column the "same category" test runs on. Deliberately separate from the page's level
   * selector: that one decides how the table above is grouped, this one decides what counts as
   * a comparable product. Defaults to sub-category, which is the only tier with a sensible
   * number of values — category has 4-5 (half the catalogue becomes a peer) and format has 63
   * (barely any peers at all).
   */
  similarityColumn: string
  /** Extra brand/dimension filters, already parameterised. */
  filterClause: string
  ids: string[]
  from: string
  to: string
  limit: number
  /** Restricts to creators whose dominant pillar is this one; empty means all. */
  pillar?: string | undefined
  params: Record<string, unknown>
}

/**
 * Creators already active in this product's sub-category who have never sold it.
 *
 * Deliberately called behind an explicit action in the UI: the "never touched" test looks back
 * 180 days, and on a table with no sorting key that is close to a full scan.
 */
export async function findOpportunityCreators(spec: OpportunitySpec): Promise<OpportunityCreatorsResult> {
  const params: Record<string, unknown> = {
    ...spec.params,
    ids: spec.ids,
    from: spec.from,
    to: spec.to,
    lookback: OPPORTUNITY_LOOKBACK_DAYS,
  }

  const subResult = await clickhouse.query({
    query: `
      SELECT ifNull(${spec.similarityColumn}, 'Unknown') AS subCategory
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${spec.scope} AND ${spec.idColumn} IN {ids:Array(String)}
      GROUP BY subCategory
      ORDER BY count() DESC
      LIMIT 1
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const subCategory = (await subResult.json<{ subCategory: string }>())[0]?.subCategory
  if (!subCategory) {
    return { subCategory: '', lookbackDays: OPPORTUNITY_LOOKBACK_DAYS, rows: [] }
  }
  params.subCategory = subCategory

  let pillarClause = ''
  if (spec.pillar) {
    params.dominant = spec.pillar
    pillarClause = ` WHERE dominantPillar = {dominant:String}`
  }

  const result = await clickhouse.query({
    query: `
      SELECT * FROM (
        SELECT
          AFFILIATE_USERNAME AS username,
          MAX(IS_MANAGED_CREATOR) AS isManaged,
          arrayStringConcat(arraySort(groupUniqArray(ifNull(BRAND_NAME, 'Unknown'))), ', ') AS brands,
          uniqExact(${spec.idColumn}) AS productCount,
          SUM(GMV) AS subCategoryGmv,
          -- Resolved here rather than in Node so the pillar filter can run before LIMIT.
          multiIf(
            sumIf(GMV, PILLAR = 'Livestream') >= sumIf(GMV, PILLAR = 'Video')
              AND sumIf(GMV, PILLAR = 'Livestream') >= sumIf(GMV, PILLAR = 'Product Card'), 'Livestream',
            sumIf(GMV, PILLAR = 'Video') >= sumIf(GMV, PILLAR = 'Product Card'), 'Video',
            'Product Card'
          ) AS dominantPillar
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${spec.scope}
          AND IS_AFFILIATE = TRUE
          AND AFFILIATE_USERNAME IS NOT NULL
          AND ifNull(${spec.similarityColumn}, 'Unknown') = {subCategory:String}
          AND ${spec.idColumn} NOT IN {ids:Array(String)}
          AND DATE >= {from:Date} AND DATE <= {to:Date}
          ${spec.filterClause}
          -- Never touched this product, over the lookback window as well as the period itself.
          AND AFFILIATE_USERNAME NOT IN (
            SELECT AFFILIATE_USERNAME FROM ${TABLE_SUMMARY_ORDER}
            WHERE ${spec.scope}
              AND ${spec.idColumn} IN {ids:Array(String)}
              AND AFFILIATE_USERNAME IS NOT NULL
              AND DATE >= today() - {lookback:UInt16}
          )
        GROUP BY username
        HAVING productCount >= ${MIN_PRODUCTS}
      )${pillarClause}
      ORDER BY isManaged DESC, subCategoryGmv DESC
      LIMIT ${Math.min(spec.limit, 100)}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const raw = await result.json<{
    username: string
    isManaged: number
    brands: string
    productCount: number
    subCategoryGmv: number
    dominantPillar: string
  }>()

  const rows: OpportunityCreatorRow[] = raw.map((r) => {
    const gmv = Number(r.subCategoryGmv || 0)
    const productCount = Number(r.productCount || 0)
    return {
      username: r.username,
      isManaged: Boolean(r.isManaged),
      brands: r.brands,
      productCount,
      subCategoryGmv: gmv,
      estimatedGmv: productCount > 0 ? gmv / productCount : 0,
      dominantPillar: r.dominantPillar,
    }
  })

  return { subCategory, lookbackDays: OPPORTUNITY_LOOKBACK_DAYS, rows }
}
