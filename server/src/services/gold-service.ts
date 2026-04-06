import { GoldPriceSnapshot } from '../../../shared/types'

const GOLDAPI_URL      = 'https://www.goldapi.io/api/XAU/USD'
const METALPRICE_URL   = 'https://api.metalpriceapi.com/v1/latest?api_key={KEY}&base=XAU&currencies=USD'

// Cache taux de change USD→MAD (15 minutes)
let rateCache: { value: number; expiresAt: number } = { value: 9.40, expiresAt: 0 }

async function getUsdToMad(): Promise<number> {
  if (Date.now() < rateCache.expiresAt) return rateCache.value
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) throw new Error('ExchangeRate API error')
    const data = await res.json() as { result: string; rates: Record<string, number> }
    if (data.result === 'success' && data.rates?.MAD) {
      rateCache = { value: data.rates.MAD, expiresAt: Date.now() + 15 * 60 * 1000 }
    }
  } catch {
    // Keep last known rate
  }
  return rateCache.value
}

// Cache prix or (10 minutes)
let priceCache: { data: GoldPriceSnapshot & { stale?: boolean }; expiresAt: number } | null = null

// Source 1 : MetalpriceAPI (gratuit 100 req/mois) — retourne USD/once
async function fetchFromMetalpriceApi(): Promise<number> {
  const key = process.env.METALPRICEAPI_KEY ?? ''
  if (!key) throw new Error('No METALPRICEAPI_KEY')
  const url = METALPRICE_URL.replace('{KEY}', key)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MetalpriceAPI error: ${res.status}`)
  const data = await res.json() as { success: boolean; rates: Record<string, number> }
  if (!data.success || !data.rates?.USD) throw new Error('MetalpriceAPI bad response')
  // base=XAU, rates.USD = USD per troy ounce
  return data.rates.USD
}

// Source 2 : GoldAPI.io — retourne données détaillées par karat
async function fetchFromGoldApi(): Promise<Record<string, number>> {
  const key = process.env.GOLDAPI_KEY ?? process.env.GOLD_API_KEY ?? ''
  if (!key) throw new Error('No GOLDAPI_KEY')
  const res = await fetch(GOLDAPI_URL, {
    headers: { 'x-access-token': key, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`GoldAPI error: ${res.status}`)
  return res.json() as Promise<Record<string, number>>
}

// Source 3 : open.er-api XAU→USD (gratuit, sans clé)
async function fetchFromErApi(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/XAU')
  if (!res.ok) throw new Error('ER-API XAU error')
  const data = await res.json() as { result: string; rates: Record<string, number> }
  if (data.result !== 'success' || !data.rates?.USD) throw new Error('No XAU/USD rate')
  return data.rates.USD
}

export async function getGoldPrices(facsonArtisan = 0): Promise<GoldPriceSnapshot & { stale?: boolean }> {
  if (priceCache && Date.now() < priceCache.expiresAt) return priceCache.data

  const usdToMad = await getUsdToMad()

  let usdPerOunce: number | null = null
  let stale = false

  // Source 1 : GoldAPI (retourne prix par karat — le plus précis)
  try {
    const data = await fetchFromGoldApi()
    const toMad = (usdPerGram: number) =>
      parseFloat(((usdPerGram * usdToMad) + facsonArtisan).toFixed(2))

    const snapshot: GoldPriceSnapshot & { stale: boolean } = {
      '9k':  toMad(data['price_gram_9k'] ?? data['price_gram_10k']),
      '14k': toMad(data['price_gram_14k']),
      '18k': toMad(data['price_gram_18k']),
      '21k': toMad(data['price_gram_21k'] ?? data['price_gram_22k'] * 0.955),
      '22k': toMad(data['price_gram_22k']),
      '24k': toMad(data['price_gram_24k']),
      usdPerOunce: data['price'],
      usdToMad: Math.round(usdToMad * 100) / 100,
      updatedAt: new Date().toISOString(),
      stale: false,
    }
    priceCache = { data: snapshot, expiresAt: Date.now() + 10 * 60 * 1000 }
    return snapshot
  } catch (e1) {
    console.warn('[GoldService] GoldAPI failed:', (e1 as Error).message)
  }

  // Source 2 : MetalpriceAPI (gratuit 100 req/mois)
  try {
    usdPerOunce = await fetchFromMetalpriceApi()
  } catch (e2) {
    console.warn('[GoldService] MetalpriceAPI failed:', (e2 as Error).message)
  }

  // Source 3 : open.er-api XAU (gratuit, sans clé)
  if (!usdPerOunce) {
    try {
      usdPerOunce = await fetchFromErApi()
    } catch (e3) {
      console.warn('[GoldService] ER-API XAU failed:', (e3 as Error).message)
    }
  }

  // If fallback worked, compute prices
  if (usdPerOunce) {
    const gramPrice24k = (usdPerOunce * usdToMad) / 31.1035
    const toMad = (purity: number) =>
      parseFloat(((gramPrice24k * purity) + facsonArtisan).toFixed(2))

    const snapshot: GoldPriceSnapshot & { stale: boolean } = {
      '9k':  toMad(0.375),
      '14k': toMad(0.585),
      '18k': toMad(0.750),
      '21k': toMad(0.875),
      '22k': toMad(0.9166),
      '24k': toMad(1),
      usdPerOunce: Math.round(usdPerOunce * 100) / 100,
      usdToMad: Math.round(usdToMad * 100) / 100,
      updatedAt: new Date().toISOString(),
      stale: false,
    }
    priceCache = { data: snapshot, expiresAt: Date.now() + 10 * 60 * 1000 }
    return snapshot
  }

  // All sources failed — return last cache as stale, or last-known values
  if (priceCache) {
    return { ...priceCache.data, stale: true }
  }

  // Ultimate fallback (last known realistic prices)
  stale = true
  const gramPrice24k = (4675 * usdToMad) / 31.1035
  const toMad = (purity: number) =>
    parseFloat(((gramPrice24k * purity) + facsonArtisan).toFixed(2))

  return {
    '9k':  toMad(0.375),
    '14k': toMad(0.585),
    '18k': toMad(0.750),
    '21k': toMad(0.875),
    '22k': toMad(0.9166),
    '24k': toMad(1),
    usdPerOunce: 4675,
    usdToMad: Math.round(usdToMad * 100) / 100,
    updatedAt: new Date().toISOString(),
    stale,
  }
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
