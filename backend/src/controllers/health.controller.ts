import type { Request, Response } from 'express'
import { checkDatabaseConnection } from '../services/health.service'

export function getHealth(_req: Request, res: Response) {
  res.json({ status: 'ok' })
}

export async function getTestDb(_req: Request, res: Response) {
  const data = await checkDatabaseConnection()
  res.json({ connected: true, data })
}
