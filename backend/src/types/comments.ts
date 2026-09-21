/** Who wrote a row. Local until Microsoft SSO lands; the columns do not change when it does. */
export interface Author {
  /** Stable key. A per-browser UUID today, the Entra `oid` once SSO is wired. */
  id: string
  name: string
  /** 'local' marks the honour-system period, so it stays distinguishable afterwards. */
  source: 'local' | 'entra'
}

export interface ProductComment {
  id: number
  productId: string | null
  barcode: string | null
  marketplace: string | null
  /** Null for a top-level comment; replies go exactly one level deep. */
  parentId: number | null
  body: string
  author: Author
  createdAt: string
  updatedAt: string
  /** Kept as a tombstone so replies below it do not vanish. */
  deleted: boolean
  replies: ProductComment[]
}

export interface PeriodAnnotation {
  id: number
  startsOn: string
  /** Equal to startsOn for a single day. */
  endsOn: string
  title: string
  body: string | null
  /** Null means it applies everywhere. */
  brand: string | null
  marketplace: string | null
  author: Author
  createdAt: string
  updatedAt: string
}
