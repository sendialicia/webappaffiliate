import { clickhouse } from './clickhouse'
import { TABLE_SUMMARY_ORDER } from './query-helpers'

/** One variant (SKU option) of a listing, both windows. */
export interface VariantContribution {
  variantId: string
  name: string
  gmv: number
  gmvPrev: number
  itemsSold: number
  /** Share of the listing's GMV in the current window. */
  share: number
}

/**
 * How a PID's GMV splits across its variants. A listing bundles several variants (shades,
 * sizes), and which of them carries the product is invisible at PID grain. The query shares
 * the detail's params (pids, both windows, filters) and its marketplace scope.
 */
export async function getVariantContribution(
  marketplaceScope: string,
  filterClause: string,
  params: Record<string, unknown>,
): Promise<VariantContribution[]> {
  const result = await clickhouse.query({
    query: `
      SELECT
        ifNull(VARIANT_ID, '(none)') AS variantId,
        argMaxIf(VARIANT_NAME, (ETL_BATCH_TIME, DATE), VARIANT_NAME IS NOT NULL) AS variantName,
        argMaxIf(VARIANT_SAP_NAME, (ETL_BATCH_TIME, DATE), VARIANT_SAP_NAME IS NOT NULL) AS sapName,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev,
        sumIf(ITEMS_SOLD, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS itemsSold
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${marketplaceScope}
        AND IS_AFFILIATE = TRUE
        AND PRODUCT_ID IN {pids:Array(String)}
        AND ((DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) OR (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}))
        ${filterClause}
      GROUP BY variantId
      ORDER BY gmv DESC
      LIMIT 100
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const rows = await result.json<{
    variantId: string
    variantName: string | null
    sapName: string | null
    gmv: number
    gmvPrev: number
    itemsSold: number
  }>()
  const total = rows.reduce((a, r) => a + Number(r.gmv || 0), 0)
  return rows.map((r) => ({
    variantId: r.variantId,
    // The marketplace variant label ("Shade 03") reads best; the SAP name is the fallback.
    name: r.variantName || r.sapName || r.variantId,
    gmv: Number(r.gmv || 0),
    gmvPrev: Number(r.gmvPrev || 0),
    itemsSold: Number(r.itemsSold || 0),
    share: total > 0 ? Number(r.gmv || 0) / total : 0,
  }))
}
