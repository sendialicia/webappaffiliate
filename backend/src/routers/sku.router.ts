import { Router } from 'express'
import {
  getSkuCategoriesHandler,
  getSkuDetailHandler,
  getSkuFilterOptionsHandler,
  getSkuProductsHandler,
  getSkuOpportunityCreatorsHandler,
  getSkuTopCreatorsHandler,
  getSkuTrendHandler,
  getSkuCreatorDetailHandler,
} from '../controllers/sku.controller'

export const skuRouter = Router()

skuRouter.get('/api/sku/categories', getSkuCategoriesHandler)
skuRouter.get('/api/sku/products', getSkuProductsHandler)
skuRouter.get('/api/sku/trend', getSkuTrendHandler)
skuRouter.get('/api/sku/detail', getSkuDetailHandler)
skuRouter.get('/api/sku/top-creators', getSkuTopCreatorsHandler)
skuRouter.get('/api/sku/opportunity-creators', getSkuOpportunityCreatorsHandler)
skuRouter.get('/api/sku/filter-options', getSkuFilterOptionsHandler)
skuRouter.get('/api/sku/creator-detail', getSkuCreatorDetailHandler)
