import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Author } from '../types/comments'

/**
 * Only the Next.js proxy route (after checking the Microsoft SSO session) and the server's own
 * cache warmer hold INTERNAL_API_SECRET, so a request without it came from somewhere else and is
 * refused. The proxy also passes who the user is; that is trusted here for the same reason —
 * nothing without the secret gets this far.
 */
export const INTERNAL_SECRET_HEADER = 'x-internal-secret'

/** Liveness probes stay open: they return no data and a load balancer has no secret. */
const OPEN_PATHS = new Set(['/health'])

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, and the length alone reveals nothing useful.
  return a.length === b.length && timingSafeEqual(a, b)
}

function decode(value: string | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function internalAuth(req: Request, res: Response, next: NextFunction) {
  if (OPEN_PATHS.has(req.path)) return next()

  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) {
    res.status(500).json({ error: 'INTERNAL_API_SECRET belum di-set di backend/.env' })
    return
  }

  const given = req.header(INTERNAL_SECRET_HEADER) ?? ''
  if (!matches(given, expected)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const id = req.header('x-user-id')
  if (id) {
    const author: Author = { id, name: decode(req.header('x-user-name')) || decode(req.header('x-user-email')) || id, source: 'entra' }
    res.locals.user = author
  }
  next()
}

/** The signed-in user, when the request came through the proxy route rather than the cache warmer. */
export function currentUser(res: Response): Author | null {
  return (res.locals.user as Author | undefined) ?? null
}
