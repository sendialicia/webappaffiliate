import type { TrendMetrics } from '../lib/query-helpers'
import type { ComparisonBasis, DetailFilters, OverviewFilters } from './overview'

/** The SKU page groups by the SKU-level dimensions, not the PID ones. */
export type SkuLevel = 'category' | 'subcategory' | 'format'

/**
 * Which family of attribute columns the level selector reads.
 *
 * A barcode and the PID that lists it are not always classified the same way — they disagree on
 * about 2.5% of rows, and 206 of 1,749 barcodes appear under more than one PID category. 'product'
 * is the SKU's own classification and stays the default; 'pid' matches how the PID pages group,
 * which is what you want when reconciling the two.
 */
export type SkuAttributeBase = 'product' | 'pid'

export interface SkuFilters extends OverviewFilters {
  scope?: string[]
  scopeLevel?: SkuLevel
  /** Defaults to 'product'. */
  attributeBase?: SkuAttributeBase
  detail?: DetailFilters
  /**
   * Mirrors the "Bundle Dipecah Flag" control on the existing Tableau page:
   * true  -> BUNDLE_FLAG = FALSE, bundles broken into their component SKUs
   * false -> ITEM_MARKETPLACE_FLAG = TRUE, the listed marketplace item as sold
   */
  bundleSplit?: boolean
  /** GWP items are giveaways with near-zero GMV, excluded unless asked for. */
  includeGwp?: boolean
  bundleType?: string[]
  marketplace?: string[]
}

/** The per-marketplace half of a row; the point of this page is comparing the two. */
export interface MarketplaceSplit {
  gmv: number
  gmvPrev: number
  itemsSold: number
  orders: number
  commission: number
  creators: number
}

export interface SkuTotals {
  gmv: number
  gmvPrev: number
  deltaRp: number
  growth: number | null
  share: number
  itemsSold: number
  orders: number
  commission: number
  creators: number
  aov: number | null
  /** Shopee's portion of this row's GMV; null when the row has no GMV at all. */
  shopeeShare: number | null
  shopee: MarketplaceSplit
  tiktok: MarketplaceSplit
}

export interface SkuCategoryRow extends SkuTotals {
  name: string
  skus: number
  /** SKUs in this group that sold on both marketplaces in the current window. */
  crossMarketplaceSkus: number
}

export interface SkuCategoriesResult {
  level: SkuLevel
  attributeBase: SkuAttributeBase
  total: SkuCategoryRow
  rows: SkuCategoryRow[]
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: ComparisonBasis }
}

export interface SkuRow extends SkuTotals {
  barcode: string
  /** Latest VARIANT_SAP_NAME for this barcode, or a composed label when it has none. */
  name: string
  /** True when the barcode carries no VARIANT_SAP_NAME — those listings are paket/bundle. */
  isPaket: boolean
  variantName: string
  productName: string
  category: string
  subCategory: string
  format: string
  /** How many PIDs list this barcode; one SKU commonly sells under several listings. */
  pidCount: number
  inScope: boolean
  crossMarketplace: boolean
}

export interface SkuProductsResult {
  rows: SkuRow[]
  scope: string | null
  countSku: number
  countCrossMarketplace: number
  countShopeeOnly: number
  countTiktokOnly: number
}

export interface SkuTrendPoint extends TrendMetrics {
  bucket: string
  shopee: number
  tiktok: number
}

export interface SkuPidContribution {
  pid: string
  productName: string
  marketplace: string
  gmv: number
  share: number
}

export interface SkuDetailMember {
  barcode: string
  name: string
  gmv: number
}

export interface SkuDetail {
  barcodes: string[]
  name: string
  members: SkuDetailMember[]
  isPaket: boolean
  /** "Beragam" once the selection spans more than one value. */
  category: string
  subCategory: string
  format: string
  totals: SkuTotals
  trend: SkuTrendPoint[]
  /** Which listings this SKU sells under, across both marketplaces. */
  pids: SkuPidContribution[]
}

export interface SkuCreatorRow {
  username: string
  isManaged: boolean
  marketplaces: string
  gmv: number
  share: number
  orders: number
  itemsSold: number
  commission: number
  aov: number
}

export interface SkuCreatorsResult {
  rows: SkuCreatorRow[]
  totalGmv: number
  concentrationTop10: number
}

export interface SkuFilterOptionsResult {
  bundleTypes: string[]
  marketplaces: string[]
}
