import type { Request, Response } from 'express'
import {
  createAnnotation,
  createComment,
  deleteAnnotation,
  deleteComment,
  listAnnotations,
  listComments,
  updateAnnotation,
  updateComment,
} from '../services/comments.service'
import { postgresHealthy } from '../lib/postgres'
import { currentUser } from '../middleware/internalAuth'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => list(v))
  return (str(value) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * The author is the signed-in user the proxy route vouched for, never whatever the request body
 * claims — otherwise anyone could post or delete as someone else.
 */
const NO_AUTHOR = { error: 'Perlu login untuk menulis atau mengubah komentar' }

export async function healthHandler(_req: Request, res: Response) {
  res.json({ ok: await postgresHealthy() })
}

export async function listCommentsHandler(req: Request, res: Response) {
  const productId = str(req.query.productId)
  const barcode = str(req.query.barcode)
  if (!productId && !barcode) {
    res.status(400).json({ error: 'productId atau barcode wajib diisi' })
    return
  }
  res.json(await listComments({ productId, barcode }))
}

export async function createCommentHandler(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const author = currentUser(res)
  const text = str(body.body)
  if (!author) {
    res.status(401).json(NO_AUTHOR)
    return
  }
  if (!text) {
    res.status(400).json({ error: 'komentar tidak boleh kosong' })
    return
  }
  const productId = str(body.productId)
  const barcode = str(body.barcode)
  if ((productId ? 1 : 0) + (barcode ? 1 : 0) !== 1) {
    res.status(400).json({ error: 'isi tepat satu dari productId atau barcode' })
    return
  }

  const parentRaw = Number(body.parentId)
  try {
    res.status(201).json(
      await createComment({
        productId,
        barcode,
        marketplace: str(body.marketplace),
        parentId: Number.isFinite(parentRaw) && parentRaw > 0 ? parentRaw : undefined,
        body: text,
        author,
      }),
    )
  } catch (e) {
    // The one-level-deep rule is enforced by a trigger, which surfaces as a database error;
    // replying to a reply is a client mistake, so it should read as 400 rather than 500.
    const message = e instanceof Error ? e.message : ''
    if (message.includes('balasan hanya boleh satu tingkat')) {
      res.status(400).json({ error: message })
      return
    }
    throw e
  }
}

export async function updateCommentHandler(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const author = currentUser(res)
  const text = str(body.body)
  if (!author || !text) {
    res.status(400).json(author ? { error: 'komentar tidak boleh kosong' } : NO_AUTHOR)
    return
  }
  const updated = await updateComment(Number(req.params.id), author.id, text)
  if (!updated) {
    res.status(404).json({ error: 'komentar tidak ditemukan atau bukan milikmu' })
    return
  }
  res.json(updated)
}

export async function deleteCommentHandler(req: Request, res: Response) {
  const authorId = currentUser(res)?.id
  if (!authorId) {
    res.status(401).json(NO_AUTHOR)
    return
  }
  const ok = await deleteComment(Number(req.params.id), authorId)
  res.status(ok ? 204 : 404).end()
}

export async function listAnnotationsHandler(req: Request, res: Response) {
  const from = str(req.query.from)
  const to = str(req.query.to)
  if (!from || !to) {
    res.status(400).json({ error: 'from dan to wajib diisi' })
    return
  }
  res.json(
    await listAnnotations({
      from,
      to,
      brands: list(req.query.brand),
      marketplaces: list(req.query.marketplace),
    }),
  )
}

export async function createAnnotationHandler(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const author = currentUser(res)
  const title = str(body.title)
  const startsOn = str(body.startsOn)
  const endsOn = str(body.endsOn) ?? startsOn
  if (!author) {
    res.status(401).json(NO_AUTHOR)
    return
  }
  if (!title || !startsOn || !endsOn) {
    res.status(400).json({ error: 'judul dan tanggal mulai wajib diisi' })
    return
  }
  if (endsOn < startsOn) {
    res.status(400).json({ error: 'tanggal selesai tidak boleh sebelum tanggal mulai' })
    return
  }
  res.status(201).json(
    await createAnnotation({
      startsOn,
      endsOn,
      title,
      body: str(body.body),
      brand: str(body.brand),
      marketplace: str(body.marketplace),
      author,
    }),
  )
}

export async function updateAnnotationHandler(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const author = currentUser(res)
  const title = str(body.title)
  const startsOn = str(body.startsOn)
  const endsOn = str(body.endsOn) ?? startsOn
  if (!author || !title || !startsOn || !endsOn) {
    res.status(400).json(author ? { error: 'judul dan tanggal mulai wajib diisi' } : NO_AUTHOR)
    return
  }
  if (endsOn < startsOn) {
    res.status(400).json({ error: 'tanggal selesai tidak boleh sebelum tanggal mulai' })
    return
  }
  const updated = await updateAnnotation(Number(req.params.id), author.id, {
    startsOn,
    endsOn,
    title,
    body: str(body.body),
  })
  if (!updated) {
    res.status(404).json({ error: 'anotasi tidak ditemukan atau bukan milikmu' })
    return
  }
  res.json(updated)
}

export async function deleteAnnotationHandler(req: Request, res: Response) {
  const authorId = currentUser(res)?.id
  if (!authorId) {
    res.status(401).json(NO_AUTHOR)
    return
  }
  const ok = await deleteAnnotation(Number(req.params.id), authorId)
  res.status(ok ? 204 : 404).end()
}
