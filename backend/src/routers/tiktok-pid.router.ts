import { Router } from 'express'
import {
  getTtCategoriesHandler,
  getTtProductDetailHandler,
  getTtProductsHandler,
  getTtOpportunityCreatorsHandler,
  getTtTopCreatorsHandler,
  getTtTrendHandler,
  getTtCreatorDetailHandler,
} from '../controllers/tiktok-pid.controller'

export const tiktokPidRouter = Router()

tiktokPidRouter.get('/api/tiktok-pid/categories', getTtCategoriesHandler)
tiktokPidRouter.get('/api/tiktok-pid/products', getTtProductsHandler)
tiktokPidRouter.get('/api/tiktok-pid/trend', getTtTrendHandler)
tiktokPidRouter.get('/api/tiktok-pid/product-detail', getTtProductDetailHandler)
tiktokPidRouter.get('/api/tiktok-pid/top-creators', getTtTopCreatorsHandler)
tiktokPidRouter.get('/api/tiktok-pid/opportunity-creators', getTtOpportunityCreatorsHandler)
tiktokPidRouter.get('/api/tiktok-pid/creator-detail', getTtCreatorDetailHandler)
