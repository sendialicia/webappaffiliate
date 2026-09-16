import type { ComparisonBasis, OverviewFilters, TrendGranularity } from './overview'

export type PidLevel = 'category' | 'subcategory' | 'format'

export interface PidFilters extends OverviewFilters {
  /** Value of the selected level that scopes products/trend/creators below. */
  scope?: string
  scopeLevel?: PidLevel
}

/** Shopee affiliate-centre attributes. CONFIRMED variant, per Sendi. */
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

export interface PidCategoryRow extends ShopeeAttributes {
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
  comparison: { from: string; to: string; basis: ComparisonBasis }
}

export interface PidProductRow extends ShopeeAttributes {
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
  countProfitProduct: number
  countDecliningProduct: number
  countScopeProduct: number
}

export interface PidTrendPoint {
  bucket: string
  gmv: number
  spGmv: number
}

export interface PidPillarContribution {
  name: string
  gmv: number
  gmvPrev: number
  share: number
  growth: number | null
  delta: number
}

export interface PidDetailMember {
  pid: string
  name: string
  gmv: number
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
  attributes: ShopeeAttributes
  trend: PidTrendPoint[]
  pillars: PidPillarContribution[]
}

export interface PidCreatorRow {
  username: string
  isManaged: boolean
  gmv: number
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
  | 'gmv-growth'
  | 'clicks-corate'
  | 'asp-units'
  | 'commrate-growth'
  | 'buyers-newshare'
