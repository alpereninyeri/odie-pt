// POST /api/health-import
// iOS Shortcuts Apple Health bridge. The shortcut sends workout/activity JSON
// with Authorization: Bearer <HEALTH_IMPORT_TOKEN>.

import { normalizeAppleHealthPayload } from '../src/data/apple-health.js'
import { recordIngestEvent } from '../lib/hevy/ingest-events.js'
import { ingestNormalizedExternalWorkout, resolveProfile } from '../lib/hevy/persist.js'

function providedToken(req) {
  const header = String(req.headers?.authorization || '')
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7)
  return req.headers?.['x-health-import-token'] || req.query?.token || req.query?.secret || ''
}

export function authorizeHealthImport(req) {
  const expected = process.env.HEALTH_IMPORT_TOKEN
  if (!expected) return { ok: false, status: 500, error: 'HEALTH_IMPORT_TOKEN tanimsiz' }
  if (providedToken(req) !== expected) return { ok: false, status: 401, error: 'unauthorized' }
  return { ok: true }
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
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      status: 'apple health import hazir',
      auth: process.env.HEALTH_IMPORT_TOKEN ? 'configured' : 'missing-token',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST gerekli' })
  }

  const auth = authorizeHealthImport(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env eksik' })
  }

  let profile = null
  let normalized = null

  try {
    const body = parseBody(req.body)
    normalized = normalizeAppleHealthPayload(body)
    if (!normalized.durationMin && !normalized.distanceKm) {
      return res.status(400).json({ ok: false, error: 'Aktivite sure veya mesafe icermeli' })
    }

    profile = await resolveProfile()
    await recordIngestEvent({
      profileId: profile?.id,
      source: 'apple_health',
      externalId: normalized.externalId,
      eventType: 'webhook',
      operation: 'received',
      status: 'received',
      payload: body,
    })

    const result = await ingestNormalizedExternalWorkout(normalized, {
      onUpdate: 'skip',
      generateCoach: true,
    })

    await recordIngestEvent({
      profileId: profile?.id,
      source: 'apple_health',
      externalId: normalized.externalId,
      eventType: 'webhook',
      operation: result.status,
      status: result.status === 'skipped' ? 'skipped' : 'processed',
      payload: {
        workoutId: result.workoutId || null,
        type: result.type,
        date: result.date,
        distanceKm: normalized.distanceKm,
        durationMin: normalized.durationMin,
      },
    })

    return res.status(200).json({
      ok: true,
      ...result,
      workout: {
        type: normalized.type,
        date: normalized.date,
        distanceKm: normalized.distanceKm,
        durationMin: normalized.durationMin,
        source: normalized.source,
      },
    })
  } catch (error) {
    await recordIngestEvent({
      profileId: profile?.id,
      source: 'apple_health',
      externalId: normalized?.externalId || '',
      eventType: 'webhook',
      operation: 'failed',
      status: 'failed',
      error: String(error?.message || error),
      payload: normalized?.rawExternal || {},
    })
    console.error('[health-import] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
