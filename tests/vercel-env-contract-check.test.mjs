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
 ODIE_APP_ACCESS_TOKEN      Encrypted           Development, Preview, Production    1d ago
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

test('vercel env contract accepts the Hevy key for the public read-only dashboard', () => {
  const result = evaluateVercelEnvContract(parseVercelEnvList(CURRENT_LIVE_SHAPE))
  assert.equal(result.ok, true)
  assert.deepEqual(result.missing, [])
  assert.equal(result.warnings.some(item => item.includes('legacy Supabase URL')), true)
  assert.equal(result.warnings.some(item => item.includes('legacy browser anon key')), true)
  assert.equal(result.warnings.some(item => item.includes('legacy Hevy sync secret')), true)
})

test('vercel env contract only requires the Hevy API key', () => {
  const names = new Set(['VITE_SUPABASE_URL', 'GEMINI_API_KEY'])
  const result = evaluateVercelEnvContract(names)
  assert.equal(result.ok, false)
  assert.deepEqual(result.missing.map(item => item.label), ['Hevy API key'])
})
