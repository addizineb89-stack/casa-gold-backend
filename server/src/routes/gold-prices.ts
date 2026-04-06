import { Router, Request, Response } from 'express'
import { getGoldPrices, calculateJewelryPrice } from '../services/gold-service'
import { detectTrends } from '../services/trend-service'

const router = Router()

// GET /api/gold/prices
// Retourne tous les prix de l'or en MAD (public)
router.get('/prices', async (_req: Request, res: Response) => {
  try {
    const facsonArtisan = parseFloat(_req.query.facade as string) || 0
    const prices = await getGoldPrices(facsonArtisan)
    return res.json(prices)
  } catch (err) {
    // Never return 500 — return last-known prices with stale flag
    console.error('[gold/prices] Unhandled error:', (err as Error).message)
    return res.status(200).json({
      '9k': 530, '14k': 830, '18k': 1070, '21k': 1248, '22k': 1310, '24k': 1400,
      usdPerOunce: 4675, usdToMad: 9.40,
      updatedAt: new Date().toISOString(),
      stale: true,
    })
  }
})

// POST /api/gold/calculate
// Calcule le prix d'un bijou
router.post('/calculate', async (req: Request, res: Response) => {
  const { weightGrams, karat, laborCostMad, marginPercent, facsonArtisan } = req.body

  if (!weightGrams || !karat) {
    return res.status(400).json({ error: 'weightGrams et karat sont requis' })
  }

  try {
    const prices = await getGoldPrices(facsonArtisan ?? 0)
    const result = calculateJewelryPrice(
      parseFloat(weightGrams),
      karat,
      parseFloat(laborCostMad ?? 0),
      parseFloat(marginPercent ?? 0),
      prices
    )
    return res.json({ ...result, goldPricePerGram: prices[karat as keyof typeof prices] })
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/gold/trends
// Retourne les tendances détectées (bijoutiers abonnés)
router.get('/trends', async (_req: Request, res: Response) => {
  try {
    const trends = await detectTrends()
    return res.json({ trends, count: trends.length })
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
