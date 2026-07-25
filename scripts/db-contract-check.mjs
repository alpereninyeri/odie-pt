import { pathToFileURL } from 'node:url'

// Hevy-only ürünün okuma ve ingest akışında gerçekten kullandığı tablo/kolonlar.
export const REQUIRED_DB_CONTRACT = [
  {
    table: 'profiles',
    columns: [
      'id',
      'nick',
      'level',
      'xp_current',
      'xp_max',
      'stats',
      'streak_current',
      'streak_max',
      'last_workout_date',
      'last_updated',
    ],
  },
  {
    table: 'workouts',
    columns: [
      'id',
      'profile_id',
      'date',
      'type',
      'duration_min',
      'volume_kg',
      'sets',
      'exercises',
      'xp_earned',
      'has_pr',
      'source',
      'external_source',
      'external_id',
      'started_at',
      'created_at',
    ],
  },
  {
    table: 'hevy_sync_state',
    columns: [
      'id',
      'profile_id',
      'last_event_id',
      'last_synced_at',
      'last_error',
    ],
  },
  {
    table: 'ingest_events',
    columns: [
      'id',
      'profile_id',
      'source',
      'external_id',
      'event_type',
      'operation',
      'status',
      'payload',
      'error',
      'processed_at',
    ],
  },
]

function normalizeBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function serviceKeyFromEnv(env = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || ''
}

export function buildRestCheckUrl(baseUrl, check) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/rest/v1/${check.table}`)
  url.searchParams.set('select', check.columns.join(','))
  url.searchParams.set('limit', '0')
  return url.toString()
}

function publicMessage(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return 'empty error response'
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/apikey["'=:\s]+[A-Za-z0-9._-]+/gi, 'apikey [redacted]')
    .slice(0, 360)
}

export async function probeDbContractCheck(check, {
  baseUrl,
  serviceKey,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!fetchImpl) throw new Error('fetch is not available')
  const response = await fetchImpl(buildRestCheckUrl(baseUrl, check), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  if (response.ok) return { ok: true, table: check.table }
  const detail = typeof response.text === 'function' ? await response.text() : ''
  return {
    ok: false,
    table: check.table,
    status: response.status,
    detail: publicMessage(detail),
  }
}

export async function runDbContractCheck({
  env = process.env,
  fetchImpl = globalThis.fetch,
  checks = REQUIRED_DB_CONTRACT,
} = {}) {
  const baseUrl = normalizeBaseUrl(env.VITE_SUPABASE_URL)
  const serviceKey = serviceKeyFromEnv(env)
  const failures = []

  if (!baseUrl) failures.push({ table: 'env', status: 0, detail: 'VITE_SUPABASE_URL missing' })
  if (!serviceKey) failures.push({ table: 'env', status: 0, detail: 'service-role key missing' })
  if (failures.length) return { ok: false, checked: 0, failures }

  for (const check of checks) {
    const result = await probeDbContractCheck(check, { baseUrl, serviceKey, fetchImpl })
    if (!result.ok) failures.push(result)
  }

  return {
    ok: failures.length === 0,
    checked: checks.length,
    failures,
  }
}

async function main() {
  const result = await runDbContractCheck()
  if (!result.ok) {
    console.error('db contract check failed:')
    for (const failure of result.failures) {
      console.error(`- ${failure.table}: ${failure.status || 'env'} ${failure.detail}`)
    }
    process.exit(1)
  }
  console.log(`db contract ok (${result.checked} checks)`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(`db contract check crashed: ${publicMessage(error?.message || error)}`)
    process.exit(1)
  })
}
