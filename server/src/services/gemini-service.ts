import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiAnalysis } from '../../../shared/types'
import { getGoldPrices } from './gold-service'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

// Analyse un bijou avec Gemini 1.5 Pro (multimodal)
export async function analyzeJewelryImage(imageUrl: string): Promise<GeminiAnalysis> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  // Télécharger l'image en base64
  const imageRes = await fetch(imageUrl)
  const imageBuffer = await imageRes.arrayBuffer()
  const base64 = Buffer.from(imageBuffer).toString('base64')
  const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'

  const goldPrices = await getGoldPrices()

  const prompt = `
Tu es un expert joaillier marocain. Analyse cette image de bijou et retourne UNIQUEMENT un JSON valide avec ces champs :
{
  "style": "Beldi" | "Moderne" | "Luxe" | "Minimaliste" | "Autre",
  "type": "Bague" | "Bracelet" | "Collier" | "Boucles" | "Pendentif" | "Autre",
  "karat": "9k" | "14k" | "18k" | "21k" | "22k" | "24k",
  "estimatedWeightGrams": number,
  "settingType": string,
  "description": string (en français, max 50 mots),
  "estimatedPriceMad": number (basé sur prix 18k = ${goldPrices['18k']} MAD/g),
  "confidence": number (0-1)
}
Ne retourne rien d'autre que le JSON.
  `.trim()

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    prompt,
  ])

  const text = result.response.text().trim()
  // Nettoyer le JSON si Gemini ajoute des backticks
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(cleaned) as GeminiAnalysis
}

// Génère un embedding vectoriel d'une image via Gemini Embedding
export async function generateImageEmbedding(imageUrl: string): Promise<number[]> {
  // Gemini Embedding pour images — utilise le modèle text-embedding-004
  // Pour les images, on embed la description générée par le modèle vision
  const visionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  const imageRes = await fetch(imageUrl)
  const imageBuffer = await imageRes.arrayBuffer()
  const base64 = Buffer.from(imageBuffer).toString('base64')
  const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'

  // Étape 1: Générer une description détaillée de l'image
  const descResult = await visionModel.generateContent([
    { inlineData: { data: base64, mimeType } },
    'Décris ce bijou en détail : matière, style, forme, motifs, pierres, finitions. Sois très précis. Max 200 mots.',
  ])
  const description = descResult.response.text()

  // Étape 2: Vectoriser la description
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const embeddingResult = await embeddingModel.embedContent(description)

  return embeddingResult.embedding.values
}
