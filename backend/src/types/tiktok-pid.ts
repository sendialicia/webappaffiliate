import type { OrderMetrics, TrendMetrics } from '../lib/query-helpers'
import type { ComparisonBasis } from './overview'
import type { PidFilters, PidLevel, PidPillarContribution, PillarSplit } from './shopee-pid'

export type { PidFilters, PidLevel }

/**
 * TikTok affiliate-centre attributes, the counterpart of ShopeeAttributes.
 *
 * Three deliberate differences from Shopee, all forced by what the table actually holds:
 * - TT_AFF_CENTER_EST_COMMISSION is 100% NULL, so commission/ROI come from the generic
 *   COMMISSION column (internal figures) rather than a marketplace-reported one.
 * - TikTok has no new-buyer column, so there is no newBuyers counterpart.
 * - ttAvgDailyCustomers is an average over days, never a sum — see TiktokAttributes.
 */
export interface TiktokAttributes {
  ttGmv: number
  ttOrders: number
  ttItemsSold: number
  ttImpressions: number
  ttClicks: number
  ttAddToCart: number
  ttAddToCartUsers: number
  ttVideos: number
  ttLiveStreams: number
  /** New videos + new live streams (affiliate centre NEW_CONTENT_COUNT), not all content. */
  ttContentCount: number
  /**
   * From TT_AVG_DAILY_CUSTOMERS. Summed across products within a day, then averaged across
   * days — never summed across days, because the source column is already a daily figure.
   */
  ttAvgDailyCustomers: number
  /** Internal COMMISSION, not a TT_ column. */
  ttCommission: number
  ttRoi: number | null
  ttCommissionRate: number | null
  ttCoRate: number | null
  ttCtr: number | null
  ttAtcRate: number | null
}

export interface TtCategoryRow extends TiktokAttributes, OrderMetrics {
  name: string
  gmv: number
  gmvPrev: number
  deltaRp: number
  share: number
  growth: number | null
  pillars: PillarSplit
  pillarGrowth: { livestream: number | null; video: number | null; productCard: number | null }
}

export interface TtCategoriesResult {
  level: PidLevel
  total: TtCategoryRow
  rows: TtCategoryRow[]
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: ComparisonBasis }
}

export interface TtProductRow extends TiktokAttributes, OrderMetrics {
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
  /** Distinct affiliates on this product, counted from the rows — not TT_AFF_TOTAL_CREATOR_COUNT. */
  creators: number
  pillars: PillarSplit
}

export interface TtProductsResult {
  rows: TtProductRow[]
  scope: string | null
  countProduct: number
  /** GMV above the comparison period, new products included. */
  countGrowingProduct: number
  countDecliningProduct: number
  countScopeProduct: number
}

export interface TtTrendPoint extends TrendMetrics {
  bucket: string
}

export interface TtDetailMember {
  pid: string
  name: string
  gmv: number
}

export interface TtProductDetail {
  pids: string[]
  name: string
  members: TtDetailMember[]
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
  attributes: TiktokAttributes
  /** Same shape for the comparison window — the lever waterfall needs both ends. */
  attributesPrev: TiktokAttributes
  trend: TtTrendPoint[]
  pillars: PidPillarContribution[]
}

export interface TtCreatorRow {
  username: string
  isManaged: boolean
  gmv: number
  /** GMV this creator produced per pillar; exact, since PILLAR is on the row grain. */
  pillars: PillarSplit
  share: number
  orders: number
  itemsSold: number
  commission: number
  aov: number
}

export interface TtCreatorsResult {
  rows: TtCreatorRow[]
  totalGmv: number
  concentrationTop10: number
}
