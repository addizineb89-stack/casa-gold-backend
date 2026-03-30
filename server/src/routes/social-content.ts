import { Router, Request, Response } from 'express'
import multer from 'multer'
import { analyzeJewelryImage, generateSocialContent } from '../services/gemini-service'
import { requireAuth } from '../middleware/auth'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Fichier image requis'))
  },
})

// POST /api/social/generate
// Prend une photo de bijou → retourne description + hashtags + hook pour chaque plateforme
router.post(
  '/generate',
  requireAuth,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      let base64: string
      let mimeType: string

      if (req.file) {
        base64 = req.file.buffer.toString('base64')
        mimeType = req.file.mimetype
      } else if (req.body.imageUrl) {
        const imageRes = await fetch(req.body.imageUrl)
        const buffer = await imageRes.arrayBuffer()
        base64 = Buffer.from(buffer).toString('base64')
        mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'
      } else {
        return res.status(400).json({ error: 'Fournir une image (fichier ou imageUrl)' })
      }

      // 1. Analyser le bijou
      const dataUrl = `data:${mimeType};base64,${base64}`
      const analysis = await analyzeJewelryImage(dataUrl)

      // 2. Générer le contenu social
      const social = await generateSocialContent(base64, mimeType, analysis)

      return res.json({
        analysis,
        social,
      })
    } catch (err) {
      console.error('Social content error:', err)
      return res.status(500).json({ error: (err as Error).message })
    }
  }
)

export default router
