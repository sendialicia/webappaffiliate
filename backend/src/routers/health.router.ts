import { Router } from 'express'
import { getHealth, getTestDb } from '../controllers/health.controller'

export const healthRouter = Router()

healthRouter.get('/health', getHealth)
healthRouter.get('/test-db', getTestDb)
