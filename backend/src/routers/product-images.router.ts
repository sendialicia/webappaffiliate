import { Router } from 'express'
import { getProductImagesHandler } from '../controllers/product-images.controller'

export const productImagesRouter = Router()

productImagesRouter.get('/api/product-images', getProductImagesHandler)
