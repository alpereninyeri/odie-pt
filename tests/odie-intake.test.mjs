import assert from 'node:assert/strict'
import test from 'node:test'

import { parseIntakeText } from '../lib/odie-intake/parser.js'

test('intake parser builds workout preview with real set and volume', () => {
  const preview = parseIntakeText('dün bench 65kg 3x5 70dk', { today: '2026-05-29' })
  assert.equal(preview.kind, 'workout')
  assert.equal(preview.record.date, '2026-05-28')
  assert.equal(preview.record.sets, 3)
  assert.equal(preview.record.volumeKg, 975)
  assert.equal(preview.requiresConfirmation, true)
})

test('intake parser separates recovery, body event, metric and question', () => {
  assert.equal(parseIntakeText('7 saat uyudum 9000 adım', { today: '2026-05-29' }).kind, 'daily_log')
  assert.equal(parseIntakeText('omuz ağrıyor', { today: '2026-05-29' }).kind, 'body_event')
  assert.equal(parseIntakeText('kilo 82kg', { today: '2026-05-29' }).kind, 'body_metric')
  assert.equal(parseIntakeText('Bugün ne yapayım?', { today: '2026-05-29' }).kind, 'question')
})

test('intake parser asks for clarification on vague text', () => {
  const preview = parseIntakeText('tamamdır', { today: '2026-05-29' })
  assert.equal(preview.kind, 'needs_clarification')
  assert.ok(preview.question)
})
