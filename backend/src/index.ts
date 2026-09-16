import express from 'express'
import cors from 'cors'
import { healthRouter } from './routers/health.router'
import { overviewRouter } from './routers/overview.router'
import { shopeePidRouter } from './routers/shopee-pid.router'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'

const app = express()
app.use(cors())
app.use(express.json())
app.use(requestLogger)

app.use(healthRouter)
app.use(overviewRouter)
app.use(shopeePidRouter)

app.use(errorHandler)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
