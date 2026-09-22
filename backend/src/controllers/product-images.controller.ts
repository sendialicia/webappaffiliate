import type { Request, Response } from 'express'
import { getProductImages, type ImageMarketplace } from '../services/product-image.service'

/** Caps one request; the summary asks for three, the ceiling is only a guard. */
const MAX_PIDS = 50

export async function getProductImagesHandler(req: Request, res: Response) {
  const marketplace = req.query.marketplace
  if (marketplace !== 'shopee' && marketplace !== 'tiktok') {
    res.status(400).json({ error: 'marketplace must be shopee or tiktok' })
    return
  }
  const pids = String(req.query.pids ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAX_PIDS)
  const images = await getProductImages(marketplace as ImageMarketplace, pids)
  res.json(Object.fromEntries(images))
}
