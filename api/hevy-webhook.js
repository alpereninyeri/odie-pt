// POST /api/hevy-webhook?secret=<HEVY_WEBHOOK_SECRET>
// Hevy "new workout" webhook'u: payload sadece { id: "<workoutId>" }.
// Auth Hevy tarafinda ayarlanamadigi icin URL'deki ?secret= ile koruyoruz.

import { getWorkout } from '../lib/hevy/client.js'
import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'
import { ingestNormalizedExternalWorkout, resolveProfile, updateSyncState } from '../lib/hevy/persist.js'

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
  const provided = req.query?.secret || req.headers?.['x-hevy-secret']
  if (provided !== expected) {
    return res.status(401).json({ ok: false, error: 'gecersiz secret' })
  }

  const id = req.body?.id || req.body?.workoutId
  if (!id) {
    return res.status(400).json({ ok: false, error: 'body.id eksik' })
  }

  try {
    const hevyWorkout = await getWorkout(id)
    if (!hevyWorkout) {
      return res.status(404).json({ ok: false, error: 'Hevy workout bulunamadi' })
    }
    const normalized = normalizeHevyWorkout(hevyWorkout)
    const result = await ingestNormalizedExternalWorkout(normalized, { onUpdate: 'replace' })

    const profile = await resolveProfile()
    if (profile) {
      await updateSyncState(profile.id, {
        last_event_id: String(id),
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
    }

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('[hevy-webhook] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
