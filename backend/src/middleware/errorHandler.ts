import type { NextFunction, Request, Response } from 'express'

/** A network-level failure reaching the warehouse, as opposed to a query error. */
function isUnreachable(message: string): boolean {
  return /timeout|ETIMEDOUT|ENETUNREACH|ECONNREFUSED|EHOSTUNREACH|socket hang up/i.test(message)
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  const message = err instanceof Error ? err.message : 'Internal server error'

  if (isUnreachable(message)) {
    res.status(503).json({
      error:
        'Tidak bisa menghubungi Snowflake. Coba muat ulang halaman; kalau terus berulang, cek koneksi internet atau kredensial Snowflake di .env.',
    })
    return
  }

  res.status(500).json({ error: message })
}
