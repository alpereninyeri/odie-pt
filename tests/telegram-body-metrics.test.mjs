import test from 'node:test'
import assert from 'node:assert/strict'

import { extractDirectBodyMetrics, isBodyMetricsOnlyMessage } from '../api/telegram.js'

test('extractDirectBodyMetrics reads kilo and boy from plain text', () => {
  const patch = extractDirectBodyMetrics('guncel kilo 72.4 boy 172')

  assert.deepEqual(patch, { weightKg: 72.4, heightCm: 172 })
})

test('body metrics only message stays in direct vital flow', () => {
  assert.equal(isBodyMetricsOnlyMessage('kilom 72.4 boy 172'), true)
})

test('workout message with kilo and boy does not short-circuit to vital-only flow', () => {
  const text = `
Push - Core - Kalf
Toplam sure 2 saat
Bench Press
Set 1: 65 kg x 8
guncel kilo 72.4 boy 172
`

  assert.equal(isBodyMetricsOnlyMessage(text), false)
})
