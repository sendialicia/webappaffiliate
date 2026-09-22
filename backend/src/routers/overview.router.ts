import { Router } from 'express'
import {
  getCompositionHandler,
  getDailyPerformanceHandler,
  getDriversHandler,
  getFilterOptionsHandler,
  getDataAvailabilityHandler,
  getDriverMatrixHandler,
  getTopCreatorsHandler,
  getFindingsInputsHandler,
  getCreatorDriversHandler,
  getFunnelHandler,
  getMonthlyPerformanceHandler,
  getProgressHandler,
  getSpendHandler,
  getSummaryHandler,
} from '../controllers/overview.controller'

export const overviewRouter = Router()

overviewRouter.get('/api/overview/monthly-performance', getMonthlyPerformanceHandler)
overviewRouter.get('/api/overview/daily-performance', getDailyPerformanceHandler)
overviewRouter.get('/api/overview/progress', getProgressHandler)
overviewRouter.get('/api/overview/summary', getSummaryHandler)
overviewRouter.get('/api/overview/composition', getCompositionHandler)
overviewRouter.get('/api/overview/drivers', getDriversHandler)
overviewRouter.get('/api/overview/driver-matrix', getDriverMatrixHandler)
overviewRouter.get('/api/overview/top-creators', getTopCreatorsHandler)
overviewRouter.get('/api/overview/findings-inputs', getFindingsInputsHandler)
overviewRouter.get('/api/overview/creator-drivers', getCreatorDriversHandler)
overviewRouter.get('/api/overview/spend', getSpendHandler)
overviewRouter.get('/api/overview/funnel', getFunnelHandler)
overviewRouter.get('/api/overview/filter-options', getFilterOptionsHandler)
overviewRouter.get('/api/overview/data-availability', getDataAvailabilityHandler)
