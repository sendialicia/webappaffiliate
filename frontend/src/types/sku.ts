import type { TrendMetricPoint } from "@/components/charts/metric-trend"
export type SkuLevel = "category" | "subcategory" | "format"

/** Which family of attribute columns the level selector reads: the SKU's own, or the listing's. */
export type SkuAttributeBase = "product" | "pid"

/** The per-marketplace half of a row; comparing the two is the point of this page. */
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
  crossMarketplaceSkus: number
}

export interface SkuCategoriesResult {
  level: SkuLevel
  attributeBase: SkuAttributeBase
  total: SkuCategoryRow
  rows: SkuCategoryRow[]
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: "prev" | "ly" }
}

export interface SkuRow extends SkuTotals {
  barcode: string
  name: string
  /** True when the barcode has no VARIANT_SAP_NAME — those listings are paket/bundle. */
  isPaket: boolean
  variantName: string
  productName: string
  category: string
  subCategory: string
  format: string
  /** How many PID listings this SKU sells under, across both marketplaces. */
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

/** Every trend endpoint returns the shared metric set (GMV, items, orders, commission, creators, AOV). */
export interface SkuTrendPoint extends TrendMetricPoint {
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
  category: string
  subCategory: string
  format: string
  totals: SkuTotals
  trend: SkuTrendPoint[]
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

/**
 * Only order-level columns are available here. The marketplace attribute columns live at PID
 * grain and one PID maps to many barcodes, so they cannot be attributed to an individual SKU.
 */
export type SkuQuadrantPreset = "shopee-tiktok" | "gmv-growth" | "sold-aov" | "creators-gmv"
