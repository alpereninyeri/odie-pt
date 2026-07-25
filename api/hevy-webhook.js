// POST /api/hevy-webhook?secret=<HEVY_WEBHOOK_SECRET>
// Hevy "new workout" webhook'u: payload sadece { id: "<workoutId>" }.
// Auth: Authorization: Bearer <HEVY_WEBHOOK_SECRET> veya x-hevy-secret header.

import fs from 'fs/promises'
import path from 'path'
import { getWorkout } from '../lib/hevy/client.js'
import { recordIngestEvent } from '../lib/hevy/ingest-events.js'
import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'
import { ingestNormalizedExternalWorkout, resolveProfile, updateSyncState } from '../lib/hevy/persist.js'
import { consumeRateLimit, rateLimitResponse } from './rate-limit.js'
import { sendPublicError } from './public-error.js'

async function backupWebhookPayload(hevyWorkout) {
  const localPath = process.env.HEVY_WEBHOOK_BACKUP_PATH || ''
  if (!localPath) return
  try {
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, JSON.stringify(hevyWorkout, null, 2))
  } catch (fsErr) {
    console.error('[hevy-webhook] local backup failed:', fsErr.message)
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, status: 'hevy webhook hazir' })
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST gerekli' })
  }

  const expected = process.env.HEVY_WEBHOOK_SECRET
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'HEVY_WEBHOOK_SECRET tanimsiz' })
  }
  const authHeader = String(req.headers?.authorization || '')
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  const devQuerySecret = process.env.NODE_ENV !== 'production' ? req.query?.secret : ''
  const provided = bearer || req.headers?.['x-hevy-secret'] || devQuerySecret
  if (provided !== expected) {
    return res.status(401).json({ ok: false, error: 'gecersiz secret' })
  }
  const rate = consumeRateLimit(req, { id: 'hevy-webhook', limit: 60, windowMs: 60_000 })
  if (!rate.ok) return rateLimitResponse(res, rate)
  if (!process.env.VITE_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return res.status(500).json({ ok: false, error: 'Supabase service env eksik' })
  }

  const id = req.body?.id || req.body?.workoutId
  if (!id) {
    return res.status(400).json({ ok: false, error: 'body.id eksik' })
  }

  let profile = null
  try {
    profile = await resolveProfile()
    await recordIngestEvent({
      profileId: profile?.id,
      externalId: id,
      eventType: 'webhook',
      operation: 'received',
      status: 'received',
      payload: { id },
    })

    const hevyWorkout = await getWorkout(id)
    if (!hevyWorkout) {
      await recordIngestEvent({
        profileId: profile?.id,
        externalId: id,
        eventType: 'webhook',
        operation: 'fetch',
        status: 'failed',
        error: 'Hevy workout bulunamadi',
        payload: { id },
      })
      return res.status(404).json({ ok: false, error: 'Hevy workout bulunamadi' })
    }

    await backupWebhookPayload(hevyWorkout)

    const normalized = normalizeHevyWorkout(hevyWorkout)
    const result = await ingestNormalizedExternalWorkout(normalized, {
      onUpdate: 'replace',
    })

    if (profile) {
      await updateSyncState(profile.id, {
        last_event_id: String(id),
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
    }

    await recordIngestEvent({
      profileId: profile?.id,
      externalId: id,
      eventType: 'webhook',
      operation: result.status,
      status: result.status === 'skipped' ? 'skipped' : 'processed',
      payload: { workoutId: result.workoutId || null, type: result.type, date: result.date },
    })

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    await recordIngestEvent({
      profileId: profile?.id,
      externalId: id,
      eventType: 'webhook',
      operation: 'failed',
      status: 'failed',
      error: String(error?.message || error),
      payload: { id },
    })
    console.error('[hevy-webhook] failed:', error?.message || error)
    return sendPublicError(res, error, { fallback: 'hevy_webhook_failed' })
  }
}
