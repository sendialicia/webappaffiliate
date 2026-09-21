import { Router } from 'express'
import {
  getPidCategoriesHandler,
  getPidProductDetailHandler,
  getPidProductsHandler,
  getOpportunityCreatorsHandler,
  getPidTopCreatorsHandler,
  getPidTrendHandler,
  getPidCreatorDetailHandler,
} from '../controllers/shopee-pid.controller'

export const shopeePidRouter = Router()

shopeePidRouter.get('/api/shopee-pid/categories', getPidCategoriesHandler)
shopeePidRouter.get('/api/shopee-pid/products', getPidProductsHandler)
shopeePidRouter.get('/api/shopee-pid/trend', getPidTrendHandler)
shopeePidRouter.get('/api/shopee-pid/product-detail', getPidProductDetailHandler)
shopeePidRouter.get('/api/shopee-pid/top-creators', getPidTopCreatorsHandler)
shopeePidRouter.get('/api/shopee-pid/opportunity-creators', getOpportunityCreatorsHandler)
shopeePidRouter.get('/api/shopee-pid/creator-detail', getPidCreatorDetailHandler)
