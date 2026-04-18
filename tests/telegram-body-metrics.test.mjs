import test from 'node:test'
import assert from 'node:assert/strict'

import { extractDirectBodyMetrics, extractWorkoutDate, isBodyMetricsOnlyMessage, parseStructuredWorkoutText } from '../api/telegram.js'

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

test('structured workout parser extracts long telegram workout details', () => {
  const text = `
Push - Core - Kalf
Cumartesi, Nis 18, 2026, 5:15pm 

Toplam süre 2 saat 

Yürüme
Set 1: 1.7 km - 25min 0s (yokuş yukarı)

Koşu Bandı
Set 1: 0.8 km - 9min 0s (11 incline interval nabız yükseltmek için) 

Esneme
4min 0s

Bench Press (Bar)
Set 1: 65 kg x 8
Set 2: 70 kg x 5
Set 3: 60 kg x 6

Incline Bench Press (Smith Machine)
Set 1: 45 kg x 8
Set 2: 45 kg x 7

Oturarak Shoulder Press (Makine)
Set 1: 30 kg x 9
Set 2: 30 kg x 7
Set 3: 30 kg x 6

Lateral Raise (Dambıl)
Set 1: 15 kg x 7
Set 2: 20 kg x 7
Set 3: 20 kg x 6

Triceps Dip
Set 1: 12 tekrar
Set 2: 10 tekrar
Set 3: 6 tekrar

Ayakta Calf Raise (Dambıl)
Set 1: 40 kg x 18
Set 2: 40 kg x 20

Back Extension (Ağırlıklı Hyperextension)
Set 1: 15 kg x 6
Set 2: 15 kg x 6

Leg Raise Parallel Bars
Set 1: 15 tekrar
Set 2: 10 tekrar
Set 3: 6 tekrar

Box Jump
Set 1: 8 tekrar
Set 2: 8 tekrar
Set 3: 8 tekrar

Sauna 10 Dk

1.5 km 24 dk yokuş aşağı yürüme ve kapanış 

güncel kilo 72.4 boy 172
`

  const parsed = parseStructuredWorkoutText(text)

  assert.equal(parsed.type, 'Push')
  assert.equal(parsed.duration_min, 120)
  assert.equal(parsed.total_sets, 29)
  assert.equal(parsed.distance_km, 4)
  assert.equal(parsed.volume_kg, 4630)
  assert.ok(parsed.tags.includes('push'))
  assert.ok(parsed.tags.includes('core'))
  assert.ok(parsed.tags.includes('legs'))
  assert.match(parsed.highlight, /70kg x 5/i)
  assert.equal(parsed.exercises[0].name, 'Yürüme')
  assert.equal(parsed.exercises.find(ex => /leg raise/i.test(ex.name))?.sets.length, 3)
})

test('extractWorkoutDate reads Turkish header date from workout text', () => {
  const text = `
Push - Core - Kalf
Cumartesi, Nis 18, 2026, 5:15pm
Toplam sure 2 saat
`

  assert.equal(extractWorkoutDate(text, '2026-04-19'), '2026-04-18')
})
