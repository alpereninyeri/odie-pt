// POST /api/hevy-backfill
// Tek seferlik (veya kademeli) tarihsel backfill.
// Hevy /v1/workouts list endpoint pageSize=10 tavanli oldugu icin biz de sayfa sayfa cekiyoruz.
//
// Auth: Authorization: Bearer <HEVY_INTERNAL_SECRET>  (header)
// veya  ?secret=<HEVY_INTERNAL_SECRET>                (query)
//
// Parametreler (query string):
//   ?pages=N         (varsayilan 5) — bu cagrida en fazla kac sayfa cekelim
//   ?startPage=M     (varsayilan 1) — kacinci sayfadan baslayalim
//   ?onUpdate=skip|replace (varsayilan skip — backfill'de mevcutlari atla)
//
// Birinci cagri: ?startPage=1&pages=10  → ilk 10 sayfa (~100 workout)
// Sonraki cagri: ?startPage=11&pages=10 → sonraki 10 sayfa
// Her workout zaten external_id index'i sayesinde idempotent.

import { listWorkouts } from '../lib/hevy/client.js'
import { recordIngestEvent } from '../lib/hevy/ingest-events.js'
import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'
import { ingestNormalizedExternalWorkout, resolveProfile, updateSyncState } from '../lib/hevy/persist.js'

function authorize(req) {
  const expected = process.env.HEVY_INTERNAL_SECRET
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

  const startPage = Math.max(1, Number(req.query?.startPage) || 1)
  const pages = Math.max(1, Math.min(20, Number(req.query?.pages) || 5))
  const onUpdate = req.query?.onUpdate === 'replace' ? 'replace' : 'skip'

  const summary = {
    startPage,
    pages,
    onUpdate,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    nextPage: null,
    pageCount: null,
  }

  try {
    const profile = await resolveProfile()
    let pageCount = startPage + pages
    for (let page = startPage; page < startPage + pages; page++) {
      const data = await listWorkouts(page, 10)
      pageCount = Number(data?.page_count || pageCount)
      summary.pageCount = pageCount
      const workouts = data?.workouts || []
      summary.fetched += workouts.length

      // Eski → yeni sirayla isle ki XP/streak akisi dogru olusun
      const ordered = [...workouts].sort((a, b) =>
        String(a.start_time || a.created_at || '').localeCompare(String(b.start_time || b.created_at || ''))
      )

      for (const workout of ordered) {
        try {
          await recordIngestEvent({
            profileId: profile?.id,
            externalId: workout?.id,
            eventType: 'backfill',
            operation: 'received',
            status: 'received',
            payload: { id: workout?.id, page },
          })
          const normalized = normalizeHevyWorkout(workout)
          const result = await ingestNormalizedExternalWorkout(normalized, { onUpdate, generateCoach: false })
          if (result.status === 'inserted') summary.inserted += 1
          else if (result.status === 'updated') summary.updated += 1
          else summary.skipped += 1
          await recordIngestEvent({
            profileId: profile?.id,
            externalId: workout?.id,
            eventType: 'backfill',
            operation: result.status,
            status: result.status === 'skipped' ? 'skipped' : 'processed',
            payload: { workoutId: result.workoutId || null, page },
          })
        } catch (error) {
          summary.errors.push({ id: workout?.id, message: String(error?.message || error) })
          await recordIngestEvent({
            profileId: profile?.id,
            externalId: workout?.id,
            eventType: 'backfill',
            operation: 'failed',
            status: 'failed',
            error: String(error?.message || error),
            payload: { id: workout?.id, page },
          })
        }
      }

      if (page >= pageCount) {
        summary.nextPage = null
        break
      }
      summary.nextPage = page + 1
    }

    if (summary.nextPage && summary.nextPage > pageCount) summary.nextPage = null

    // Backfill bitince sync cursor'u "simdi"ye al ki delta sync gereksiz eski event cekmesin
    if (!summary.nextPage) {
      if (profile) {
        await updateSyncState(profile.id, {
          events_since: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          last_error: summary.errors.length ? JSON.stringify(summary.errors).slice(0, 500) : null,
        })
      }
    }

    return res.status(200).json({ ok: true, summary })
  } catch (error) {
    console.error('[hevy-backfill] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error), summary })
  }
}
