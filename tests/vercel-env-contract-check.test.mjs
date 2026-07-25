import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateVercelEnvContract,
  parseVercelEnvList,
} from '../scripts/vercel-env-contract-check.mjs'

const LEGACY_ANON_ENV = ['VITE', 'SUPABASE', 'ANON', 'KEY'].join('_')

const CURRENT_LIVE_SHAPE = `
 name                       value               environments                        created
 HEALTH_IMPORT_TOKEN        Encrypted           Production                          34d ago
 HEVY_INTERNAL_SECRET       Encrypted           Development, Preview, Production    53d ago
 HEVY_WEBHOOK_SECRET        Encrypted           Development, Preview, Production    53d ago
 HEVY_API_KEY               Encrypted           Development, Preview, Production    53d ago
 VITE_SUPABASE_URL          Encrypted           Development, Preview, Production    70d ago
 ${LEGACY_ANON_ENV}     Encrypted           Development, Preview, Production    70d ago
 TELEGRAM_BOT_TOKEN         Encrypted           Production, Preview, Development    70d ago
 GEMINI_API_KEY             Encrypted           Development, Preview, Production    70d ago
`

test('vercel env parser extracts env names without values', () => {
  const names = parseVercelEnvList(CURRENT_LIVE_SHAPE)
  assert.equal(names.has('HEVY_API_KEY'), true)
  assert.equal(names.has('VITE_SUPABASE_URL'), true)
  assert.equal(names.has('Encrypted'), false)
})

test('vercel env contract flags current live missing service key and app token', () => {
  const result = evaluateVercelEnvContract(parseVercelEnvList(CURRENT_LIVE_SHAPE))
  assert.equal(result.ok, false)
  assert.deepEqual(
    result.missing.map(item => item.label),
    ['Supabase service key', 'App access token'],
  )
  assert.equal(result.warnings.some(item => item.includes('legacy browser anon key')), true)
})

test('vercel env contract passes when secure server keys are present', () => {
  const names = parseVercelEnvList(`${CURRENT_LIVE_SHAPE}
 SUPABASE_SERVICE_ROLE_KEY   Encrypted           Production                          1m ago
 ODIE_APP_ACCESS_TOKEN       Encrypted           Production                          1m ago
`)
  const result = evaluateVercelEnvContract(names)
  assert.equal(result.ok, true)
  assert.equal(result.missing.length, 0)
})

test('vercel env contract accepts service-key and cron-secret aliases', () => {
  const names = new Set([
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ODIE_APP_ACCESS_TOKEN',
    'HEVY_API_KEY',
    'HEVY_WEBHOOK_SECRET',
    'CRON_SECRET',
  ])
  const result = evaluateVercelEnvContract(names)
  assert.equal(result.ok, true)
})
