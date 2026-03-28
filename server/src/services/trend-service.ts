import { createClient } from '@supabase/supabase-js'
import { TrendAlert, JewelryStyle, SocialPlatform } from '../../../shared/types'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// Compare les 7 derniers jours vs les 7 jours précédents pour détecter les tendances
export async function detectTrends(): Promise<TrendAlert[]> {
  const now = new Date()
  const day7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Période récente (7 derniers jours)
  const { data: recent } = await supabase
    .from('jewelry_items')
    .select('style, platform, likes, comments')
    .gte('created_at', day7)

  // Période précédente (7-14 jours)
  const { data: previous } = await supabase
    .from('jewelry_items')
    .select('style, platform, likes, comments')
    .gte('created_at', day14)
    .lt('created_at', day7)

  if (!recent || !previous) return []

  const alerts: TrendAlert[] = []
  const styles: JewelryStyle[] = ['Beldi', 'Moderne', 'Luxe', 'Minimaliste']

  for (const style of styles) {
    const recentItems   = recent.filter((i) => i.style === style)
    const previousItems = previous.filter((i) => i.style === style)

    const recentCount   = recentItems.length
    const previousCount = previousItems.length

    if (previousCount === 0) continue

    const changePercent = ((recentCount - previousCount) / previousCount) * 100

    // Seuil : variation > 15%
    if (Math.abs(changePercent) >= 15) {
      // Plateforme dominante dans la période récente
      const platformCounts = recentItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.platform] = (acc[item.platform] ?? 0) + 1
        return acc
      }, {})
      const topPlatform = (Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Instagram') as SocialPlatform

      alerts.push({
        style,
        changePercent: parseFloat(changePercent.toFixed(1)),
        direction: changePercent > 0 ? 'up' : 'down',
        period: '7 jours',
        topPlatform,
        description: `${changePercent > 0 ? 'Hausse' : 'Baisse'} de ${Math.abs(changePercent).toFixed(0)}% des modèles ${style} sur ${topPlatform}`,
      })
    }
  }

  // Trier par amplitude de changement
  return alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
}
