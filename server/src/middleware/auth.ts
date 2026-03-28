import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// Vérifie le token JWT Supabase et attache l'utilisateur à la requête
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Token invalide' })
  }

  req.user = user
  next()
}

// Vérifie que l'utilisateur est un bijoutier avec abonnement actif
export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, plan, plan_expires_at')
      .eq('id', req.user!.id)
      .single()

    if (error || !profile) {
      return res.status(403).json({ error: 'Profil introuvable' })
    }

    // Vérifier le rôle bijoutier
    if (profile.role !== 'bijoutier' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux bijoutiers' })
    }

    // Vérifier l'abonnement actif
    if (profile.plan === 'free') {
      return res.status(403).json({ error: 'Abonnement Pro Partner requis' })
    }

    if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Abonnement expiré' })
    }

    next()
  })
}

// Vérification pour les routes admin uniquement
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user!.id)
      .single()

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès admin requis' })
    }
    next()
  })
}

// Extension du type Express Request
declare global {
  namespace Express {
    interface Request {
      user?: import('@supabase/supabase-js').User
    }
  }
}
