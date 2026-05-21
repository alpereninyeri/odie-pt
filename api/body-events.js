import { normalizeBodyEventRow, toSupabaseBodyEvent } from '../src/data/body-events.js'

function sbHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY
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

async function sbPost(table, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return /relation .* does not exist/i.test(message) || /table .* does not exist/i.test(message) || /schema cache/i.test(message) || /PGRST204/i.test(message)
}

async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID
  if (explicitId) {
    const rows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    return rows?.[0] || null
  }
  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function parseBody(body) {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body
}

export default async function handler(req, res) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env eksik' })
  }

  try {
    const profile = await resolveProfile()
    if (!profile?.id) return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })

    if (req.method === 'GET') {
      try {
        const rows = await sbGet(`body_events?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=40`)
        return res.status(200).json({ ok: true, events: (rows || []).map(row => normalizeBodyEventRow(row)) })
      } catch (error) {
        if (isMissingRelation(error)) return res.status(200).json({ ok: true, events: [], missing: true })
        throw error
      }
    }

    if (req.method === 'POST') {
      const event = toSupabaseBodyEvent(parseBody(req.body))
      try {
        const rows = await sbPost('body_events', [{ ...event, profile_id: profile.id }])
        return res.status(200).json({ ok: true, event: normalizeBodyEventRow(rows?.[0] || event) })
      } catch (error) {
        if (isMissingRelation(error)) return res.status(200).json({ ok: false, missing: true, event })
        throw error
      }
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'GET veya POST gerekli' })
  } catch (error) {
    console.error('[body-events] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
