import type { PillarSplit } from "./shopee-pid"

export interface CreatorProductRow {
  id: string
  name: string
  gmv: number
  share: number
}

export interface CreatorTrendPoint {
  bucket: string
  gmv: number
}

/** Everything the creator pop-up shows, all from the order table. */
export interface CreatorDetail {
  username: string
  isManaged: boolean
  gmv: number
  orders: number
  itemsSold: number
  commission: number
  aov: number | null
  /** Days inside the window on which this creator actually sold. */
  activeDays: number
  productCount: number
  rank: number
  totalCreators: number
  /** Share of creators this one beats; 1 means top of the scope. */
  percentile: number
  pillars: PillarSplit
  brands: string[]
  marketplaces: string[]
  categoryCount: number
  subCategoryCount: number
  topProducts: CreatorProductRow[]
  trend: CreatorTrendPoint[]
}
