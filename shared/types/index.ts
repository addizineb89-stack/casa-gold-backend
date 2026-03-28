// ============================================
// SHARED TYPES — Casa Gold Intelligence
// ============================================

export type JewelryStyle = 'Beldi' | 'Moderne' | 'Luxe' | 'Minimaliste' | 'Autre'
export type JewelryType = 'Bague' | 'Bracelet' | 'Collier' | 'Boucles' | 'Pendentif' | 'Autre'
export type GoldKarat = '9k' | '14k' | '18k' | '21k' | '22k' | '24k'
export type SocialPlatform = 'Instagram' | 'TikTok' | 'Pinterest' | 'LuxuryBrand'
export type UserRole = 'client' | 'bijoutier' | 'admin'
export type SubscriptionPlan = 'free' | 'aura' | 'pro_partner'

// Prix de l'or
export interface GoldPrice {
  karat: GoldKarat
  pricePerGram: number   // MAD/g
  updatedAt: string
  changePercent?: number
}

export interface GoldPriceSnapshot {
  '9k': number
  '14k': number
  '18k': number
  '21k': number
  '22k': number
  '24k': number
  usdPerOunce: number
  usdToMad: number
  updatedAt: string
}

// Bijou scrappé / ingéré
export interface JewelryItem {
  id?: string
  imageUrl: string
  sourceUrl: string
  platform: SocialPlatform
  style?: JewelryStyle
  type?: JewelryType
  karat?: GoldKarat
  estimatedWeightGrams?: number
  settingType?: string        // ex: "Sertissage pavé"
  estimatedPriceMad?: number
  viralScore?: number
  likes?: number
  comments?: number
  embeddingVector?: number[]  // Pinecone vector
  pineconeId?: string
  createdAt?: string
}

// Résultat analyse Gemini
export interface GeminiAnalysis {
  style: JewelryStyle
  type: JewelryType
  karat: GoldKarat
  estimatedWeightGrams: number
  settingType: string
  description: string
  estimatedPriceMad: number
  confidence: number
}

// Résultat recherche visuelle
export interface VisualSearchResult {
  jewelryId: string
  imageUrl: string
  sourceUrl: string
  platform: SocialPlatform
  style: JewelryStyle
  estimatedPriceMad: number
  similarity: number  // 0-1
}

// Tendance détectée
export interface TrendAlert {
  style: JewelryStyle
  changePercent: number
  direction: 'up' | 'down'
  period: string
  topPlatform: SocialPlatform
  description: string
}

// Payload webhook n8n
export interface N8nWebhookPayload {
  items: Array<{
    imageUrl: string
    sourceUrl: string
    platform: SocialPlatform
    likes?: number
    comments?: number
    scrapedAt: string
  }>
  secret: string
}
