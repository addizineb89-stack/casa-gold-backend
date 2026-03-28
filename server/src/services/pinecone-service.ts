import { Pinecone } from '@pinecone-database/pinecone'
import { JewelryItem, VisualSearchResult } from '../../../shared/types'

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY ?? '' })
const index = pc.index(process.env.PINECONE_INDEX_NAME ?? 'casa-gold-jewelry')

// Stocker un bijou avec son vecteur dans Pinecone
export async function upsertJewelry(item: JewelryItem & { embeddingVector: number[] }): Promise<string> {
  const id = item.id ?? `${item.platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  await index.upsert([
    {
      id,
      values: item.embeddingVector,
      metadata: {
        imageUrl:             item.imageUrl,
        sourceUrl:            item.sourceUrl,
        platform:             item.platform,
        style:                item.style ?? 'Autre',
        type:                 item.type ?? 'Autre',
        karat:                item.karat ?? '18k',
        estimatedWeightGrams: item.estimatedWeightGrams ?? 0,
        settingType:          item.settingType ?? '',
        estimatedPriceMad:    item.estimatedPriceMad ?? 0,
        viralScore:           item.viralScore ?? 0,
        likes:                item.likes ?? 0,
        comments:             item.comments ?? 0,
        createdAt:            item.createdAt ?? new Date().toISOString(),
      },
    },
  ])

  return id
}

// Recherche les 10 bijoux les plus similaires
export async function searchSimilarJewelry(
  queryVector: number[],
  topK = 10
): Promise<VisualSearchResult[]> {
  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  })

  return (results.matches ?? []).map((match) => ({
    jewelryId:         match.id,
    imageUrl:          match.metadata?.imageUrl as string,
    sourceUrl:         match.metadata?.sourceUrl as string,
    platform:          match.metadata?.platform as VisualSearchResult['platform'],
    style:             match.metadata?.style as VisualSearchResult['style'],
    estimatedPriceMad: match.metadata?.estimatedPriceMad as number,
    similarity:        match.score ?? 0,
  }))
}

// Statistiques par style (pour l'analyse de tendances)
export async function getStyleStats(): Promise<Record<string, number>> {
  const styles = ['Beldi', 'Moderne', 'Luxe', 'Minimaliste', 'Autre']
  const stats: Record<string, number> = {}

  for (const style of styles) {
    const res = await index.query({
      vector: new Array(768).fill(0), // vecteur neutre
      topK: 1000,
      includeMetadata: true,
      filter: { style: { $eq: style } },
    })
    stats[style] = res.matches?.length ?? 0
  }

  return stats
}
