import { GoldPriceSnapshot } from '../../../shared/types'

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/USD'
const USD_TO_MAD   = parseFloat(process.env.USD_TO_MAD_RATE ?? '10.0')

// Cache en mémoire (5 minutes)
let cache: { data: GoldPriceSnapshot; expiresAt: number } | null = null

export async function getGoldPrices(facsonArtisan = 0): Promise<GoldPriceSnapshot> {
  if (cache && Date.now() < cache.expiresAt) return cache.data

  const res = await fetch(GOLD_API_URL, {
    headers: {
      'x-access-token': process.env.GOLD_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) throw new Error(`GoldAPI error: ${res.status}`)

  const data = await res.json()

  // GoldAPI retourne directement le prix par gramme par karat en MAD
  const toMad = (usdPerGram: number) =>
    parseFloat(((usdPerGram * USD_TO_MAD) + facsonArtisan).toFixed(2))

  const snapshot: GoldPriceSnapshot = {
    '9k':  toMad(data.price_gram_10k),
    '14k': toMad(data.price_gram_14k),
    '18k': toMad(data.price_gram_18k),
    '21k': toMad(data.price_gram_21k ?? data.price_gram_22k * 0.955),
    '22k': toMad(data.price_gram_22k),
    '24k': toMad(data.price_gram_24k),
    usdPerOunce: data.price,
    usdToMad:    USD_TO_MAD,
    updatedAt:   new Date().toISOString(),
  }

  cache = { data: snapshot, expiresAt: Date.now() + 5 * 60 * 1000 }
  return snapshot
}

export function calculateJewelryPrice(
  weightGrams: number,
  karat: string,
  laborCostMad: number,
  marginPercent: number,
  goldPrices: GoldPriceSnapshot
) {
  const pricePerGram = goldPrices[karat as keyof GoldPriceSnapshot] as number
  const goldCost     = weightGrams * pricePerGram
  const subtotal     = goldCost + laborCostMad
  const marginAmount = subtotal * (marginPercent / 100)
  const totalPrice   = subtotal + marginAmount

  return {
    goldCost:     parseFloat(goldCost.toFixed(2)),
    laborCost:    parseFloat(laborCostMad.toFixed(2)),
    marginAmount: parseFloat(marginAmount.toFixed(2)),
    totalPrice:   parseFloat(totalPrice.toFixed(2)),
  }
}
