import type { TrendMetricPoint } from "@/components/charts/metric-trend"
export type PidLevel = "category" | "subcategory" | "format"

/**
 * Order volume from the internal order data — the headline source for orders, items and
 * commission. The SP_/TT_ centre attributes count differently (Shopee's include cancelled
 * orders) and are kept only for what the order data lacks: clicks, buyers, impressions.
 */
export interface OrderMetrics {
  orders: number
  itemsSold: number
  commission: number
  aov: number | null
  roi: number | null
  commissionRate: number | null
}

export interface ShopeeAttributes {
  spGmv: number
  spOrders: number
  spClicks: number
  spBuyers: number
  spNewBuyers: number
  spProductSold: number
  spCommission: number
  spRoi: number | null
  spCoRate: number | null
}

export interface PillarSplit {
  livestream: number
  video: number
  productCard: number
}

export interface PidCategoryRow extends ShopeeAttributes, OrderMetrics {
  name: string
  gmv: number
  gmvPrev: number
  deltaRp: number
  share: number
  growth: number | null
  pillars: PillarSplit
  pillarGrowth: { livestream: number | null; video: number | null; productCard: number | null }
}

export interface PidCategoriesResult {
  level: PidLevel
  total: PidCategoryRow
  rows: PidCategoryRow[]
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: "prev" | "ly" }
}

export interface PidProductRow extends ShopeeAttributes, OrderMetrics {
  pid: string
  name: string
  category: string
  subCategory: string
  format: string
  inScope: boolean
  gmv: number
  gmvPrev: number
  growth: number | null
  share: number
  creators: number
  pillars: PillarSplit
}

export interface PidProductsResult {
  rows: PidProductRow[]
  scope: string | null
  countProduct: number
  /** GMV above the comparison period, new products included. */
  countGrowingProduct: number
  countDecliningProduct: number
  countScopeProduct: number
}

/** Every trend endpoint returns the shared metric set (GMV, items, orders, commission, creators, AOV). */
export type PidTrendPoint = TrendMetricPoint

export interface PidPillarContribution {
  name: string
  gmv: number
  gmvPrev: number
  share: number
  growth: number | null
  delta: number
}

/** Product photo, resolved from the marketplace integration dimensions. */
export interface ProductImage {
  /** Thumbnail — requested first. */
  url: string
  /** Full-size original, used if the thumbnail 404s. */
  fallback: string
}

export interface PidDetailMember {
  pid: string
  name: string
  gmv: number
  /** null when the product has no photo, or the lookup was unavailable. */
  image: ProductImage | null
}

/** Covers a single product and a combined selection of several; members carries the breakdown. */
export interface PidProductDetail {
  pids: string[]
  name: string
  members: PidDetailMember[]
  /** "Beragam" once the selection spans more than one value. */
  category: string
  subCategory: string
  format: string
  gmv: number
  gmvPrev: number
  growth: number | null
  creators: number
  /** Needed to split the GMV move into "more creators" versus "more per creator". */
  creatorsPrev: number
  /** Affiliate orders, both windows — the waterfall's denominator for CO rate and AOV. */
  orders: number
  ordersPrev: number
  attributes: ShopeeAttributes
  /** Same shape for the comparison window — the lever waterfall needs both ends. */
  attributesPrev: ShopeeAttributes
  trend: PidTrendPoint[]
  pillars: PidPillarContribution[]
  variants: VariantContribution[]
}

export interface PidCreatorRow {
  username: string
  isManaged: boolean
  gmv: number
  /** GMV this creator produced per pillar; exact, since PILLAR sits on the row grain. */
  pillars: PillarSplit
  share: number
  orders: number
  itemsSold: number
  commission: number
  aov: number
}

export interface PidCreatorsResult {
  rows: PidCreatorRow[]
  totalGmv: number
  concentrationTop10: number
}

export type QuadrantPreset =
  | "gmv-growth"
  | "clicks-corate"
  | "asp-units"
  | "commrate-growth"
  | "buyers-newshare"

/**
 * A creator already active in this product's sub-category who has never touched this PID.
 * A shortlist to approach, not a forecast — see `estimatedGmv`.
 */
export interface OpportunityCreatorRow {
  username: string
  isManaged: boolean
  brands: string
  productCount: number
  subCategoryGmv: number
  /**
   * subCategoryGmv / productCount. Deliberately crude: it assumes this product would perform
   * like the creator's average product in the sub-category, which it may well not.
   */
  estimatedGmv: number
  dominantPillar: string
}

export interface OpportunityCreatorsResult {
  subCategory: string
  lookbackDays: number
  rows: OpportunityCreatorRow[]
}

/** One variant (shade, size, bundle) of a listing, both windows. */
export interface VariantContribution {
  variantId: string
  name: string
  gmv: number
  gmvPrev: number
  itemsSold: number
  share: number
}

/** One row of a PID page's creator leaderboard; growth is against the comparison window. */
export interface CreatorLeader {
  username: string
  isManaged: boolean
  gmv: number
  gmvPrev: number
  growth: number | null
  share: number
}

export interface CreatorLeadersResult {
  rows: CreatorLeader[]
  totalGmv: number
  /** TikTok's aggregated "Agency" username, reported beside the ranking rather than in it. */
  agency: CreatorLeader | null
}
