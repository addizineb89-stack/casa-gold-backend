import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import goldRouter from './routes/gold-prices'
import webhookRouter from './routes/ingestion-webhook'
import visualSearchRouter from './routes/visual-search'

const app = express()
const PORT = process.env.PORT ?? 3001

// Middlewares
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL ?? '*' }))
app.use(express.json({ limit: '50mb' }))

// Routes
app.use('/api/gold',    goldRouter)
app.use('/api/webhook', webhookRouter)
app.use('/api',         visualSearchRouter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`Casa Gold Backend running on port ${PORT}`)
})

export default app
