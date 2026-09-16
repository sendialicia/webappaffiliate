import type { NextFunction, Request, Response } from 'express'

/** ClickHouse is on an internal network, so "VPN is off" is the usual cause here. */
function isUnreachable(message: string): boolean {
  return /timeout|ETIMEDOUT|ENETUNREACH|ECONNREFUSED|EHOSTUNREACH|socket hang up/i.test(message)
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  const message = err instanceof Error ? err.message : 'Internal server error'

  if (isUnreachable(message)) {
    res.status(503).json({
      error:
        'Tidak bisa menghubungi ClickHouse. Biasanya ini karena VPN belum aktif — nyalakan VPN lalu muat ulang halaman.',
    })
    return
  }

  res.status(500).json({ error: message })
}
