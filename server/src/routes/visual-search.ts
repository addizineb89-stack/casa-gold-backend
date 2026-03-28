import { Router, Request, Response } from 'express'
import multer from 'multer'
import { generateImageEmbedding } from '../services/gemini-service'
import { searchSimilarJewelry } from '../services/pinecone-service'
import { requireSubscription } from '../middleware/auth'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Fichier image requis'))
  },
})

// POST /api/search-by-image
// Recherche les 10 bijoux les plus similaires à l'image uploadée
router.post(
  '/search-by-image',
  requireSubscription,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      let imageUrl: string | undefined = req.body.imageUrl
      let tempImageUrl: string | undefined

      // Option 1: URL directe
      if (!imageUrl && req.file) {
        // Option 2: Upload fichier — convertir en base64 data URL temporaire
        const base64 = req.file.buffer.toString('base64')
        tempImageUrl = `data:${req.file.mimetype};base64,${base64}`
        imageUrl = tempImageUrl
      }

      if (!imageUrl) {
        return res.status(400).json({ error: 'Fournir imageUrl ou un fichier image' })
      }

      // 1. Générer l'embedding de l'image requête
      const queryVector = await generateImageEmbedding(imageUrl)

      // 2. Rechercher dans Pinecone
      const results = await searchSimilarJewelry(queryVector, 10)

      return res.json({
        results,
        count: results.length,
        query: imageUrl.startsWith('data:') ? 'upload' : imageUrl,
      })
    } catch (err) {
      console.error('Visual search error:', err)
      return res.status(500).json({ error: (err as Error).message })
    }
  }
)

export default router
