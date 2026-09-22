import type { OrderMetrics, ProductImage, VariantContribution } from "@/types/shopee-pid"
import type { TrendMetricPoint } from "@/components/charts/metric-trend"
import type { PidLevel, PidPillarContribution, PillarSplit } from "./shopee-pid"

export type { PidLevel, PidPillarContribution, PillarSplit }

/**
 * TikTok affiliate-centre attributes. Three deliberate gaps versus Shopee, all forced by the
 * data: TT_AFF_CENTER_EST_COMMISSION is entirely NULL so commission and ROI come from the
 * internal COMMISSION column, there is no new-buyer counterpart, and ttAvgDailyCustomers is
 * an average across days rather than a total.
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
  ttContentCount: number
  /** Averaged over the days present in the window, never summed. */
  ttAvgDailyCustomers: number
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
  comparison: { from: string; to: string; basis: "prev" | "ly" }
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

/** Every trend endpoint returns the shared metric set (GMV, items, orders, commission, creators, AOV). */
export type TtTrendPoint = TrendMetricPoint

export interface TtDetailMember {
  pid: string
  name: string
  gmv: number
  /** null when the product has no photo, or the lookup was unavailable. */
  image: ProductImage | null
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
  variants: VariantContribution[]
}

export interface TtCreatorRow {
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

export interface TtCreatorsResult {
  rows: TtCreatorRow[]
  totalGmv: number
  concentrationTop10: number
}

/**
 * Shopee's "buyers-newshare" has no counterpart — TikTok carries no new-buyer column — so it is
 * replaced by four views built on what TikTok does have: the impression/click funnel, the cart
 * step, and the content and creator counts that Shopee does not report at all.
 */
export type TtQuadrantPreset =
  | "gmv-growth"
  | "clicks-corate"
  | "asp-units"
  | "commrate-growth"
  | "impressions-ctr"
  | "atc-rate"
  | "content-gmv"
  | "creators-gmv"
