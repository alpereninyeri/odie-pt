// GET/POST /api/hevy-sync
// Delta sync: Hevy /v1/workouts/events endpoint'inden son senkrondan beri degisen
// workout'lari ceker. Webhook kacirsa bile bu yakalar. Vercel cron'dan veya manuel
// tetikten cagrilir.
//
// Auth: Authorization: Bearer <HEVY_INTERNAL_SECRET>  (header)
// veya  ?secret=<HEVY_INTERNAL_SECRET>                (query)
//
// Vercel Cron icin de `CRON_SECRET` veya `HEVY_INTERNAL_SECRET` bearer header
// olarak gelmeli. `x-vercel-cron` tek basina auth sayilmaz.

import { getWorkout, getWorkoutEvents } from '../lib/hevy/client.js'
import { recordIngestEvent } from '../lib/hevy/ingest-events.js'
import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'
import {
  deleteByExternalId,
  getSyncState,
  ingestNormalizedExternalWorkout,
  resolveProfile,
  updateSyncState,
} from '../lib/hevy/persist.js'

const SOURCE = 'hevy'
const DEFAULT_LOOKBACK_DAYS = 14

function authorize(req) {
  const expected = process.env.HEVY_INTERNAL_SECRET || process.env.CRON_SECRET
  if (!expected) return false
  const header = String(req.headers?.authorization || '')
  if (header.toLowerCase().startsWith('bearer ') && header.slice(7) === expected) return true
  if (req.query?.secret === expected) return true
  return false
}

export default async function handler(req, res) {
  if (!authorize(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  try {
    const profile = await resolveProfile()
    if (!profile) return res.status(500).json({ ok: false, error: 'Profil bulunamadi' })

    const state = await getSyncState(profile.id)
    const since =
      state?.events_since
      || new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86400 * 1000).toISOString()

    const summary = { fetched: 0, ingested: 0, updated: 0, deleted: 0, skipped: 0, errors: [] }
    let page = 1
    let pageCount = 1
    let latestEventTime = since

    while (page <= pageCount) {
      const data = await getWorkoutEvents(since, page, 10)
      pageCount = Number(data?.page_count || 1)
      const events = data?.events || []
      summary.fetched += events.length

      // Eski → yeni sirayla isle (Hevy yeniden eskiye veriyor olabilir)
      const ordered = [...events].sort((a, b) =>
        String(a.updated_at || a.created_at || '').localeCompare(String(b.updated_at || b.created_at || ''))
      )

      for (const event of ordered) {
        try {
          const eventTime = event.updated_at || event.created_at
          if (eventTime && eventTime > latestEventTime) latestEventTime = eventTime
          await recordIngestEvent({
            profileId: profile.id,
            externalId: event.id,
            eventType: event.type || 'sync',
            operation: 'received',
            status: 'received',
            payload: event,
          })

          if (event.type === 'deleted') {
            const result = await deleteByExternalId(SOURCE, String(event.id))
            if (result.status === 'deleted') summary.deleted += 1
            else summary.skipped += 1
            await recordIngestEvent({
              profileId: profile.id,
              externalId: event.id,
              eventType: 'deleted',
              operation: result.status,
              status: result.status === 'deleted' ? 'processed' : 'skipped',
              payload: { result },
            })
            continue
          }

          // event.type === 'updated' (ya da herhangi bir aktif event)
          const hevyWorkout = await getWorkout(event.id)
          if (!hevyWorkout) {
            summary.skipped += 1
            await recordIngestEvent({
              profileId: profile.id,
              externalId: event.id,
              eventType: event.type || 'sync',
              operation: 'fetch',
              status: 'skipped',
              payload: { reason: 'Hevy workout bulunamadi' },
            })
            continue
          }
          const normalized = normalizeHevyWorkout(hevyWorkout)
          const result = await ingestNormalizedExternalWorkout(normalized, { onUpdate: 'replace' })
          if (result.status === 'inserted') summary.ingested += 1
          else if (result.status === 'updated') summary.updated += 1
          else summary.skipped += 1
          await recordIngestEvent({
            profileId: profile.id,
            externalId: event.id,
            eventType: event.type || 'sync',
            operation: result.status,
            status: result.status === 'skipped' ? 'skipped' : 'processed',
            payload: { workoutId: result.workoutId || null, type: result.type, date: result.date },
          })
        } catch (error) {
          summary.errors.push({ id: event?.id, message: String(error?.message || error) })
          await recordIngestEvent({
            profileId: profile.id,
            externalId: event?.id,
            eventType: event?.type || 'sync',
            operation: 'failed',
            status: 'failed',
            error: String(error?.message || error),
            payload: event || {},
          })
        }
      }

      page += 1
      // 10/page tavanli pagination - 30+ sayfada bile sonlanmasi lazim ama guvende ol:
      if (page > 50) break
    }

    await updateSyncState(profile.id, {
      events_since: latestEventTime,
      last_synced_at: new Date().toISOString(),
      last_error: summary.errors.length ? JSON.stringify(summary.errors).slice(0, 500) : null,
    })

    return res.status(200).json({ ok: true, since, summary })
  } catch (error) {
    console.error('[hevy-sync] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
