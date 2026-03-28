import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { analyzeJewelryImage, generateImageEmbedding } from '../services/gemini-service'
import { upsertJewelry } from '../services/pinecone-service'
import { N8nWebhookPayload } from '../../../shared/types'

const router = Router()
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// POST /api/webhook/ingest
// Reçoit les données scrapées de n8n (Instagram, TikTok, Pinterest via Apify/RapidAPI)
router.post('/ingest', async (req: Request, res: Response) => {
  const payload = req.body as N8nWebhookPayload

  // Vérification du secret webhook
  if (payload.secret !== process.env.N8N_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!payload.items?.length) {
    return res.status(400).json({ error: 'No items provided' })
  }

  const results = { success: 0, failed: 0, errors: [] as string[] }

  // Traitement en parallèle par batch de 3 (limite API Gemini)
  for (let i = 0; i < payload.items.length; i += 3) {
    const batch = payload.items.slice(i, i + 3)

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          // 1. Analyse IA avec Gemini 1.5 Pro
          const analysis = await analyzeJewelryImage(item.imageUrl)

          // 2. Générer l'embedding vectoriel
          const embeddingVector = await generateImageEmbedding(item.imageUrl)

          // 3. Stocker dans Supabase
          const { data: dbItem, error } = await supabase
            .from('jewelry_items')
            .insert({
              image_url:              item.imageUrl,
              source_url:             item.sourceUrl,
              platform:               item.platform,
              style:                  analysis.style,
              type:                   analysis.type,
              karat:                  analysis.karat,
              estimated_weight_grams: analysis.estimatedWeightGrams,
              setting_type:           analysis.settingType,
              description:            analysis.description,
              estimated_price_mad:    analysis.estimatedPriceMad,
              likes:                  item.likes ?? 0,
              comments:               item.comments ?? 0,
              viral_score:            calculateViralScore(item.likes ?? 0, item.comments ?? 0),
              scraped_at:             item.scrapedAt,
            })
            .select('id')
            .single()

          if (error) throw new Error(error.message)

          // 4. Stocker le vecteur dans Pinecone
          const pineconeId = await upsertJewelry({
            id:                    dbItem.id,
            imageUrl:              item.imageUrl,
            sourceUrl:             item.sourceUrl,
            platform:              item.platform,
            style:                 analysis.style,
            type:                  analysis.type,
            karat:                 analysis.karat,
            estimatedWeightGrams:  analysis.estimatedWeightGrams,
            settingType:           analysis.settingType,
            estimatedPriceMad:     analysis.estimatedPriceMad,
            likes:                 item.likes,
            embeddingVector,
            createdAt:             item.scrapedAt,
          })

          // 5. Mettre à jour pinecone_id dans Supabase
          await supabase
            .from('jewelry_items')
            .update({ pinecone_id: pineconeId })
            .eq('id', dbItem.id)

          results.success++
        } catch (err) {
          results.failed++
          results.errors.push(`${item.sourceUrl}: ${(err as Error).message}`)
        }
      })
    )

    // Pause entre les batches pour éviter rate limit
    if (i + 3 < payload.items.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return res.json({
    message: `Traité: ${results.success} succès, ${results.failed} erreurs`,
    ...results,
  })
})

function calculateViralScore(likes: number, comments: number): number {
  // Score basé sur engagement (likes + comments * 2), normalisé 0-100
  const raw = likes + comments * 2
  return Math.min(100, Math.round(raw / 100))
}

export default router
