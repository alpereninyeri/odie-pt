import { applyBodyEventAction, normalizeBodyEventRow, toSupabaseBodyEvent } from '../src/data/body-events.js'
import { requireAppAccess } from './app-auth.js'

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

async function sbPatch(table, filter, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.status === 204 ? [] : response.json()
}

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return /relation .* does not exist/i.test(message) || /table .* does not exist/i.test(message) || /schema cache/i.test(message) || /PGRST204/i.test(message)
}

function bodyEventsMissing(res) {
  return res.status(503).json({
    ok: false,
    error: 'body_events_missing',
    schemaReady: false,
    events: [],
  })
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

function activeStatusFilter() {
  return 'status=in.(active,watch,rehab)'
}

function asLimit(value, fallback = 40) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(100, Math.round(numeric)))
}

function toPatchPayload(event = {}) {
  return {
    kind: event.kind,
    region: event.region,
    side: event.side,
    severity: event.severity,
    recovery_percent: event.baseRecoveryPercent ?? event.recoveryPercent,
    expected_clear_at: event.expectedClearAt || null,
    status: event.status,
    note: event.note || '',
    source: event.source || 'manual',
    odie_interpretation: event.odieInterpretation || null,
    updated_at: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  if (!requireAppAccess(req, res)) return

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env eksik' })
  }

  try {
    const profile = await resolveProfile()
    if (!profile?.id) return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })

    if (req.method === 'GET') {
      try {
        const limit = asLimit(req.query?.limit, 40)
        const rows = await sbGet(`body_events?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=${limit}`)
        return res.status(200).json({ ok: true, schemaReady: true, events: (rows || []).map(row => normalizeBodyEventRow(row)) })
      } catch (error) {
        if (isMissingRelation(error)) return bodyEventsMissing(res)
        throw error
      }
    }

    if (req.method === 'POST') {
      const event = toSupabaseBodyEvent(parseBody(req.body))
      try {
        const activeRows = await sbGet(`body_events?select=*&profile_id=eq.${profile.id}&region=eq.${encodeURIComponent(event.region)}&${activeStatusFilter()}&order=created_at.desc&limit=1`)
        if (activeRows?.[0]) {
          return res.status(409).json({
            ok: false,
            error: 'active_body_event_exists',
            schemaReady: true,
            event: normalizeBodyEventRow(activeRows[0]),
          })
        }
        const rows = await sbPost('body_events', [{ ...event, profile_id: profile.id }])
        return res.status(200).json({ ok: true, schemaReady: true, event: normalizeBodyEventRow(rows?.[0] || event) })
      } catch (error) {
        if (isMissingRelation(error)) return bodyEventsMissing(res)
        throw error
      }
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req.body)
      const id = String(body.id || req.query?.id || '').trim()
      if (!id) return res.status(400).json({ ok: false, error: 'body_event_id_required', schemaReady: true })

      try {
        const rows = await sbGet(`body_events?select=*&profile_id=eq.${profile.id}&id=eq.${encodeURIComponent(id)}&limit=1`)
        const existing = rows?.[0]
        if (!existing) return res.status(404).json({ ok: false, error: 'body_event_not_found', schemaReady: true })

        const patchedEvent = applyBodyEventAction(normalizeBodyEventRow(existing), body)
        const patchedRows = await sbPatch('body_events', `profile_id=eq.${profile.id}&id=eq.${encodeURIComponent(id)}`, toPatchPayload(patchedEvent))
        return res.status(200).json({ ok: true, schemaReady: true, event: normalizeBodyEventRow(patchedRows?.[0] || patchedEvent) })
      } catch (error) {
        if (isMissingRelation(error)) return bodyEventsMissing(res)
        throw error
      }
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ ok: false, error: 'GET, POST veya PATCH gerekli' })
  } catch (error) {
    console.error('[body-events] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
