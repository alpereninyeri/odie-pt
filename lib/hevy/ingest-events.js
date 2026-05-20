import { isMissingColumnError, sbPost } from './persist.js'

export function normalizeHevyEventType(event = {}, fallback = 'sync') {
  const raw = String(event?.type || event?.event_type || fallback || 'sync').toLowerCase()
  if (raw.includes('delete')) return 'deleted'
  if (raw.includes('update')) return 'updated'
  if (raw.includes('create') || raw.includes('insert') || raw.includes('new')) return 'created'
  if (raw.includes('backfill')) return 'backfill'
  if (raw.includes('webhook')) return 'webhook'
  return 'sync'
}

export function buildIngestEventRow({
  profileId = null,
  source = 'hevy',
  externalId = '',
  eventType = 'sync',
  operation = 'sync',
  status = 'received',
  payload = null,
  error = '',
} = {}) {
  return {
    profile_id: profileId || null,
    source,
    external_id: externalId ? String(externalId) : '',
    event_type: normalizeHevyEventType({ type: eventType }, eventType),
    operation: String(operation || 'sync').slice(0, 64),
    status: String(status || 'received').slice(0, 32),
    error: error ? String(error).slice(0, 800) : null,
    payload: payload && typeof payload === 'object' ? payload : {},
    processed_at: new Date().toISOString(),
  }
}

function isMissingIngestTable(error) {
  const message = String(error?.message || error || '')
  return isMissingColumnError(error) || /ingest_events/i.test(message)
}

export async function recordIngestEvent(input = {}) {
  const row = buildIngestEventRow(input)
  try {
    await sbPost('ingest_events', [row])
  } catch (error) {
    if (isMissingIngestTable(error)) return { ok: false, skipped: true, reason: 'missing-ingest-events' }
    console.warn('[hevy-ingest-events] record failed:', error?.message || error)
    return { ok: false, skipped: false, reason: String(error?.message || error) }
  }
  return { ok: true, row }
}
