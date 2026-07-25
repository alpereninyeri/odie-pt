import { appAuthConfigured, authorizeAppRequest } from './app-auth.js'

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function sbGet(path) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return /relation .* does not exist/i.test(message)
    || /table .* does not exist/i.test(message)
    || /schema cache/i.test(message)
    || /PGRST204/i.test(message)
}

async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch (error) {
    if (isMissingRelation(error)) return fallback
    throw error
  }
}

async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID || process.env.ODIE_PROFILE_ID
  if (explicitId) {
    const rows = await sbGet(`profiles?select=*&id=eq.${encodeURIComponent(explicitId)}&limit=1`)
    return rows?.[0] || null
  }
  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function asLimit(value, fallback, max) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(max, Math.round(numeric)))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET gerekli' })
  }
  if (!appAuthConfigured()) {
    return res.status(401).json({ ok: false, error: 'snapshot token is required' })
  }
  if (!authorizeAppRequest(req).ok) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  if (!process.env.VITE_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return res.status(500).json({ ok: false, error: 'Supabase service env eksik' })
  }

  try {
    const profile = await resolveProfile()
    if (!profile?.id) return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })

    const workoutLimit = asLimit(req.query?.workouts, 240, 400)
    const [workouts, syncRows] = await Promise.all([
      sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=${workoutLimit}`),
      sbGetSafe(`hevy_sync_state?select=*&profile_id=eq.${profile.id}&limit=1`, []),
    ])

    return res.status(200).json({
      ok: true,
      profile,
      workouts: workouts || [],
      syncState: syncRows?.[0] || null,
      source: {
        hevy: process.env.HEVY_API_KEY ? 'configured' : 'missing',
      },
    })
  } catch (error) {
    console.error('[snapshot] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: 'snapshot_failed' })
  }
}
