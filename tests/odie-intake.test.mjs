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

test('intake parser previews body event recovery updates', () => {
  const set = parseIntakeText('bilek %80 oldu', { today: '2026-06-01' })
  assert.equal(set.kind, 'body_event_update')
  assert.equal(set.record.region, 'wrist')
  assert.equal(set.record.action, 'set_recovery')
  assert.equal(set.record.recoveryPercent, 80)

  const resolved = parseIntakeText('bileği kapat iyileşti', { today: '2026-06-01' })
  assert.equal(resolved.kind, 'body_event_update')
  assert.equal(resolved.record.region, 'wrist')
  assert.equal(resolved.record.action, 'resolve')
})

test('intake parser asks region for vague body event update', () => {
  const preview = parseIntakeText('iyileşti kapat', { today: '2026-06-01' })
  assert.equal(preview.kind, 'needs_clarification')
  assert.match(preview.question, /Hangi bölge/)
})

test('intake parser handles natural Turkish shorthand examples from QA brief', () => {
  const workout = parseIntakeText('d\u00fcn g\u00f6\u011f\u00fcs \u00e7al\u0131\u015ft\u0131m 4 set bench 60 kilo', { today: '2026-06-01' })
  assert.equal(workout.kind, 'workout')
  assert.equal(workout.record.date, '2026-05-31')
  assert.equal(workout.record.sets, 4)
  assert.equal(workout.record.volumeKg, 240)
  assert.equal(workout.record.exercises[0].sets.length, 4)

  const bodyEvent = parseIntakeText('omuz a\u011fr\u0131yor sa\u011f taraf', { today: '2026-06-01' })
  assert.equal(bodyEvent.kind, 'body_event')
  assert.equal(bodyEvent.record.region, 'shoulder')
  assert.equal(bodyEvent.record.side, 'sa\u011f')

  const bodyMetric = parseIntakeText('kilom 78', { today: '2026-06-01' })
  assert.equal(bodyMetric.kind, 'body_metric')
  assert.equal(bodyMetric.record.metrics.weightKg, 78)

  const vague = parseIntakeText('bi \u015feyler yapt\u0131m', { today: '2026-06-01' })
  assert.equal(vague.kind, 'needs_clarification')
})
