import { postgres } from '../lib/postgres'
import type { Author, PeriodAnnotation, ProductComment } from '../types/comments'

interface CommentRow {
  id: string
  product_id: string | null
  barcode: string | null
  marketplace: string | null
  parent_id: string | null
  body: string
  author_id: string
  author_name: string
  author_source: 'local' | 'entra'
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

function toAuthor(r: { author_id: string; author_name: string; author_source: 'local' | 'entra' }): Author {
  return { id: r.author_id, name: r.author_name, source: r.author_source }
}

function toComment(r: CommentRow): ProductComment {
  return {
    id: Number(r.id),
    productId: r.product_id,
    barcode: r.barcode,
    marketplace: r.marketplace,
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    // A deleted comment keeps its row so its replies still have somewhere to hang.
    body: r.deleted_at ? '' : r.body,
    author: toAuthor(r),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    deleted: r.deleted_at !== null,
    replies: [],
  }
}

export interface CommentTarget {
  productId?: string | undefined
  barcode?: string | undefined
}

/** Top-level comments oldest-first, each with its replies nested one level. */
export async function listComments(target: CommentTarget): Promise<ProductComment[]> {
  const { rows } = await postgres.query<CommentRow>(
    `SELECT * FROM product_comments
     WHERE ($1::text IS NULL OR product_id = $1)
       AND ($2::text IS NULL OR barcode = $2)
       AND ($1::text IS NOT NULL OR $2::text IS NOT NULL)
     ORDER BY created_at ASC`,
    [target.productId ?? null, target.barcode ?? null],
  )

  const all = rows.map(toComment)
  const byId = new Map(all.map((c) => [c.id, c]))
  const roots: ProductComment[] = []
  for (const c of all) {
    if (c.parentId === null) roots.push(c)
    else byId.get(c.parentId)?.replies.push(c)
  }
  // A thread whose root was deleted and which never drew a reply is just noise.
  return roots.filter((c) => !c.deleted || c.replies.length > 0)
}

export async function createComment(input: {
  productId?: string | undefined
  barcode?: string | undefined
  marketplace?: string | undefined
  parentId?: number | undefined
  body: string
  author: Author
}): Promise<ProductComment> {
  const { rows } = await postgres.query<CommentRow>(
    `INSERT INTO product_comments
       (product_id, barcode, marketplace, parent_id, body, author_id, author_name, author_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.productId ?? null,
      input.barcode ?? null,
      input.marketplace ?? null,
      input.parentId ?? null,
      input.body.trim(),
      input.author.id,
      input.author.name,
      input.author.source,
    ],
  )
  return toComment(rows[0]!)
}

/**
 * Only the author may change their own row. Identity is unverified until SSO, so this is a
 * guard rail rather than a security boundary — worth saying out loud.
 */
export async function updateComment(
  id: number,
  authorId: string,
  body: string,
): Promise<ProductComment | null> {
  const { rows } = await postgres.query<CommentRow>(
    `UPDATE product_comments
     SET body = $3, updated_at = now()
     WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, authorId, body.trim()],
  )
  return rows[0] ? toComment(rows[0]) : null
}

export async function deleteComment(id: number, authorId: string): Promise<boolean> {
  const { rowCount } = await postgres.query(
    `UPDATE product_comments SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
    [id, authorId],
  )
  return (rowCount ?? 0) > 0
}

interface AnnotationRow {
  id: string
  /** Plain 'YYYY-MM-DD' — the DATE parser is disabled, see lib/postgres.ts. */
  starts_on: string
  ends_on: string
  title: string
  body: string | null
  brand: string | null
  marketplace: string | null
  author_id: string
  author_name: string
  author_source: 'local' | 'entra'
  created_at: Date
  updated_at: Date
}

function toAnnotation(r: AnnotationRow): PeriodAnnotation {
  return {
    id: Number(r.id),
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    title: r.title,
    body: r.body,
    brand: r.brand,
    marketplace: r.marketplace,
    author: toAuthor(r),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

/**
 * Every annotation whose range touches the window, narrowed to the active scope. A NULL brand or
 * marketplace means "applies everywhere", so those always come back.
 */
export async function listAnnotations(input: {
  from: string
  to: string
  brands: string[]
  marketplaces: string[]
}): Promise<PeriodAnnotation[]> {
  const { rows } = await postgres.query<AnnotationRow>(
    `SELECT * FROM period_annotations
     WHERE deleted_at IS NULL
       AND daterange(starts_on, ends_on, '[]') && daterange($1::date, $2::date, '[]')
       AND (brand IS NULL OR cardinality($3::text[]) = 0 OR brand = ANY($3::text[]))
       AND (marketplace IS NULL OR cardinality($4::text[]) = 0 OR marketplace = ANY($4::text[]))
     ORDER BY starts_on ASC, id ASC`,
    [input.from, input.to, input.brands, input.marketplaces],
  )
  return rows.map(toAnnotation)
}

export async function createAnnotation(input: {
  startsOn: string
  endsOn: string
  title: string
  body?: string | undefined
  brand?: string | undefined
  marketplace?: string | undefined
  author: Author
}): Promise<PeriodAnnotation> {
  const { rows } = await postgres.query<AnnotationRow>(
    `INSERT INTO period_annotations
       (starts_on, ends_on, title, body, brand, marketplace, author_id, author_name, author_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.startsOn,
      input.endsOn,
      input.title.trim(),
      input.body?.trim() || null,
      input.brand || null,
      input.marketplace || null,
      input.author.id,
      input.author.name,
      input.author.source,
    ],
  )
  return toAnnotation(rows[0]!)
}

export async function updateAnnotation(
  id: number,
  authorId: string,
  patch: { startsOn: string; endsOn: string; title: string; body?: string | undefined },
): Promise<PeriodAnnotation | null> {
  const { rows } = await postgres.query<AnnotationRow>(
    `UPDATE period_annotations
     SET starts_on = $3, ends_on = $4, title = $5, body = $6, updated_at = now()
     WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, authorId, patch.startsOn, patch.endsOn, patch.title.trim(), patch.body?.trim() || null],
  )
  return rows[0] ? toAnnotation(rows[0]) : null
}

export async function deleteAnnotation(id: number, authorId: string): Promise<boolean> {
  const { rowCount } = await postgres.query(
    `UPDATE period_annotations SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
    [id, authorId],
  )
  return (rowCount ?? 0) > 0
}
